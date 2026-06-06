import type {
  AddSponsorRequest,
  AppState,
  DerivedAppState,
  SponsorRankingItem,
  SponsorRecord,
  StateRepository,
  UpdateSettingsRequest
} from "../../shared/types";
import { STARTUP_FUNDING_PROGRAM_NAME } from "../../shared/displayUnits";
import type { SponsorAvatarStorage } from "./AvatarService";

const DEFAULT_TARGET_AMOUNT = 1000;
const DEFAULT_SLOGAN = "赞助点将，名场面马上开演";
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_RANKING_WINDOW_MS = 60 * DAY_MS;
const TRASH_RETENTION_MS = 7 * DAY_MS;

type DonationServiceOptions = {
  avatarStorage?: SponsorAvatarStorage;
  roomSlug?: string;
};

// Business rules live here so HTTP, persistence, and pages only move state around.
export class DonationService {
  public constructor(
    private readonly repository: StateRepository,
    private readonly options: DonationServiceOptions = {}
  ) {}

  public async getState(): Promise<DerivedAppState> {
    return this.deriveState(await this.loadState());
  }

  public async addSponsor(request: AddSponsorRequest): Promise<DerivedAppState> {
    const bossName = request.bossName.trim();
    const countsTowardCharge = request.countsTowardCharge !== false;
    const requestedProgramName = request.programName.trim();
    const programName = countsTowardCharge ? STARTUP_FUNDING_PROGRAM_NAME : requestedProgramName;
    const amount = Number(request.amount);

    if (!bossName || !programName || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("老板名、节目名和赞助金额都必须填写正确");
    }

    const state = await this.loadState();
    const sponsorId = crypto.randomUUID();
    const avatarUrl = request.avatarDataUrl
      ? await this.options.avatarStorage?.saveAvatar(this.roomSlug(), sponsorId, request.avatarDataUrl)
      : undefined;
    const sponsors = await this.backfillMissingBossAvatars(state.sponsors, bossName, request.avatarDataUrl);
    const nextRecord: SponsorRecord = {
      id: sponsorId,
      bossName,
      amount: this.roundAmount(amount),
      programName,
      note: request.note?.trim() ?? "",
      countsTowardCharge,
      avatarUrl,
      createdAt: Date.now()
    };

    const nextState: AppState = {
      ...state,
      sponsors: [...sponsors, nextRecord]
    };

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async deleteSponsor(id: string): Promise<DerivedAppState> {
    const state = await this.loadState();
    const deletedAt = Date.now();
    let found = false;
    const nextState = this.normalizeChargeConsumption({
      ...state,
      sponsors: state.sponsors.map((record) => {
        if (record.id !== id || this.isDeleted(record)) {
          return record;
        }

        found = true;
        return { ...record, deletedAt };
      })
    });

    if (!found) {
      return this.deriveState(nextState);
    }

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async deleteAllSponsors(): Promise<DerivedAppState> {
    const state = await this.loadState();
    const deletedAt = Date.now();
    let changed = false;
    const nextState = this.normalizeChargeConsumption({
      ...state,
      sponsors: state.sponsors.map((record) => {
        if (this.isDeleted(record)) {
          return record;
        }

        changed = true;
        return { ...record, deletedAt };
      })
    });

    if (!changed) {
      return this.deriveState(nextState);
    }

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async listTrashSponsors(): Promise<SponsorRecord[]> {
    const state = await this.loadState();
    return state.sponsors
      .filter((record) => this.isDeleted(record))
      .sort((left, right) => (right.deletedAt ?? 0) - (left.deletedAt ?? 0));
  }

  public async deleteSponsorPermanently(id: string): Promise<DerivedAppState> {
    const state = await this.loadState();
    const record = state.sponsors.find((item) => item.id === id && this.isDeleted(item));
    if (!record) {
      throw new Error("回收站记录不存在");
    }

    if (record.avatarUrl) {
      await this.options.avatarStorage?.clearAvatar(record.avatarUrl);
    }
    const nextState = this.normalizeChargeConsumption({
      ...state,
      sponsors: state.sponsors.filter((item) => item.id !== id)
    });
    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async clearSponsorTrash(): Promise<DerivedAppState> {
    const state = await this.loadState();
    const trashRecords = state.sponsors.filter((record) => this.isDeleted(record));
    if (trashRecords.length === 0) {
      return this.deriveState(state);
    }

    await Promise.all(
      trashRecords
        .filter((record) => record.avatarUrl)
        .map((record) => this.options.avatarStorage?.clearAvatar(record.avatarUrl))
    );
    const nextState = this.normalizeChargeConsumption({
      ...state,
      sponsors: state.sponsors.filter((record) => !this.isDeleted(record))
    });
    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async restoreSponsor(id: string): Promise<DerivedAppState> {
    const state = await this.loadState();
    let found = false;
    const sponsors = state.sponsors.map((record) => {
      if (record.id !== id || !this.isDeleted(record)) {
        return record;
      }

      found = true;
      return { ...record, deletedAt: undefined };
    });

    if (!found) {
      throw new Error("回收站记录不存在");
    }

    const nextState = this.normalizeChargeConsumption({ ...state, sponsors });
    await this.repository.save(nextState);
    return { ...this.deriveState(nextState), restoredSponsorId: id };
  }

  public async startDianjiang(): Promise<DerivedAppState> {
    const state = await this.loadState();
    const currentChargeAmount = this.currentChargeAmount(state);
    const consumedNow = Math.min(currentChargeAmount, state.targetAmount);
    if (consumedNow <= 0) {
      return this.deriveState(state);
    }

    const nextState: AppState = {
      ...state,
      chargeConsumedAmount: this.roundAmount(state.chargeConsumedAmount + consumedNow),
      lastDianjiangEffectAt: Date.now()
    };

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async updateSponsorAmount(id: string, amount: number): Promise<DerivedAppState> {
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new Error("赞助金额必须大于 0");
    }

    const state = await this.loadState();
    let found = false;
    const sponsors = state.sponsors.map((record) => {
      if (record.id !== id) {
        return record;
      }

      found = true;
      return { ...record, amount: this.roundAmount(nextAmount) };
    });

    if (!found) {
      throw new Error("赞助记录不存在");
    }

    const nextState = this.normalizeChargeConsumption({ ...state, sponsors });
    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async updateSponsorAvatar(id: string, avatarDataUrl: string | null): Promise<DerivedAppState> {
    const state = await this.loadState();
    let foundRecord: SponsorRecord | undefined;

    for (const record of state.sponsors) {
      if (record.id === id) {
        foundRecord = record;
        break;
      }
    }

    if (!foundRecord) {
      throw new Error("璧炲姪璁板綍涓嶅瓨鍦?");
    }

    let nextAvatarUrl: string | undefined;
    if (avatarDataUrl) {
      nextAvatarUrl = await this.options.avatarStorage?.saveAvatar(this.roomSlug(), foundRecord.id, avatarDataUrl);
      if (foundRecord.avatarUrl !== nextAvatarUrl) {
        await this.options.avatarStorage?.clearAvatar(foundRecord.avatarUrl);
      }
    } else {
      await this.options.avatarStorage?.clearAvatar(foundRecord.avatarUrl);
    }

    const sponsors = state.sponsors.map((record) => {
      if (record.id !== id) {
        return record;
      }

      return { ...record, avatarUrl: nextAvatarUrl };
    });

    const nextState: AppState = { ...state, sponsors };
    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async removeSponsorFromToday(id: string): Promise<DerivedAppState> {
    const state = await this.loadState();
    const hiddenAt = Date.now();
    let found = false;
    const sponsors = state.sponsors.map((record) => {
      if (record.id !== id || this.isDeleted(record)) {
        return record;
      }

      found = true;
      return { ...record, hiddenFromTodayAt: hiddenAt };
    });

    if (!found) {
      throw new Error("赞助记录不存在");
    }

    const nextState: AppState = { ...state, sponsors };
    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async addSponsorToToday(id: string): Promise<DerivedAppState> {
    const state = await this.loadState();
    let found = false;
    const sponsors = state.sponsors.map((record) => {
      if (record.id !== id || this.isDeleted(record)) {
        return record;
      }

      found = true;
      return { ...record, hiddenFromTodayAt: undefined };
    });

    if (!found) {
      throw new Error("赞助记录不存在");
    }

    const nextState: AppState = { ...state, sponsors };
    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async removeTodaySponsors(): Promise<DerivedAppState> {
    const state = await this.loadState();
    const now = Date.now();
    const todayIds = new Set(this.buildTodayProgramQueue(state.sponsors, now).map((record) => record.id));
    const sponsors = state.sponsors.map((record) => {
      if (!todayIds.has(record.id)) {
        return record;
      }

      return { ...record, hiddenFromTodayAt: now };
    });

    const nextState: AppState = { ...state, sponsors };
    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async updateTargetAmount(targetAmount: number): Promise<DerivedAppState> {
    const nextTargetAmount = Number(targetAmount);
    if (!Number.isFinite(nextTargetAmount) || nextTargetAmount <= 0) {
      throw new Error("目标金额必须大于 0");
    }

    const state = await this.loadState();
    const nextState: AppState = {
      ...state,
      targetAmount: this.roundAmount(nextTargetAmount)
    };

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async updateSettings(request: UpdateSettingsRequest): Promise<DerivedAppState> {
    const nextTargetAmount = Number(request.targetAmount);
    const nextSlogan = request.slogan.trim() || DEFAULT_SLOGAN;

    if (!Number.isFinite(nextTargetAmount) || nextTargetAmount <= 0) {
      throw new Error("目标金额必须大于 0");
    }

    const state = await this.loadState();
    const nextState: AppState = {
      ...state,
      targetAmount: this.roundAmount(nextTargetAmount),
      slogan: nextSlogan
    };

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  private async loadState(): Promise<AppState> {
    const state = this.normalizeState(await this.repository.load());
    return this.purgeExpiredTrash(state);
  }

  private async purgeExpiredTrash(state: AppState): Promise<AppState> {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const expiredRecords = state.sponsors.filter((record) => Number.isFinite(record.deletedAt) && record.deletedAt! <= cutoff);
    if (expiredRecords.length === 0) {
      return state;
    }

    await Promise.all(
      expiredRecords
        .filter((record) => record.avatarUrl)
        .map((record) => this.options.avatarStorage?.clearAvatar(record.avatarUrl))
    );
    const nextState = this.normalizeChargeConsumption({
      ...state,
      sponsors: state.sponsors.filter((record) => !expiredRecords.some((expired) => expired.id === record.id))
    });
    await this.repository.save(nextState);
    return nextState;
  }

  private normalizeState(state: AppState): AppState {
    const sponsors = Array.isArray(state.sponsors) ? state.sponsors.map((record) => this.normalizeRecord(record)) : [];
    return this.normalizeChargeConsumption({
      targetAmount: state.targetAmount > 0 ? this.roundAmount(state.targetAmount) : DEFAULT_TARGET_AMOUNT,
      slogan: state.slogan?.trim() || DEFAULT_SLOGAN,
      chargeConsumedAmount: this.sanitizeAmount(state.chargeConsumedAmount),
      lastDianjiangEffectAt: Number.isFinite(state.lastDianjiangEffectAt) ? state.lastDianjiangEffectAt : undefined,
      sponsors
    });
  }

  private normalizeRecord(record: SponsorRecord): SponsorRecord {
    return {
      ...record,
      amount: this.sanitizeAmount(record.amount),
      note: record.note ?? "",
      countsTowardCharge: record.countsTowardCharge !== false,
      avatarUrl: typeof record.avatarUrl === "string" && record.avatarUrl.trim() ? record.avatarUrl : undefined,
      hiddenFromTodayAt: Number.isFinite(record.hiddenFromTodayAt) ? record.hiddenFromTodayAt : undefined,
      deletedAt: Number.isFinite(record.deletedAt) ? record.deletedAt : undefined
    };
  }

  private deriveState(state: AppState): DerivedAppState {
    const activeSponsors = this.activeRecords(state.sponsors);
    const activeState = { ...state, sponsors: activeSponsors };
    const totalAmount = this.currentChargeAmount(activeState);
    const progressPercent = Math.min(100, Math.round((totalAmount / state.targetAmount) * 10000) / 100);
    const now = Date.now();

    return {
      ...activeState,
      totalAmount,
      progressPercent,
      goalReached: totalAmount >= state.targetAmount,
      ranking: this.buildRanking(activeSponsors, now),
      programQueue: this.buildTodayProgramQueue(activeSponsors, now)
    };
  }

  private currentChargeAmount(state: AppState): number {
    const chargeAmount = this.chargeSponsorAmount(state.sponsors);

    return Math.max(0, this.roundAmount(chargeAmount - state.chargeConsumedAmount));
  }

  private normalizeChargeConsumption(state: AppState): AppState {
    return {
      ...state,
      chargeConsumedAmount: Math.min(this.sanitizeAmount(state.chargeConsumedAmount), this.chargeSponsorAmount(state.sponsors))
    };
  }

  private chargeSponsorAmount(records: SponsorRecord[]): number {
    return this.roundAmount(
      records.reduce((sum, record) => {
        return !this.isDeleted(record) && record.countsTowardCharge ? sum + record.amount : sum;
      }, 0)
    );
  }

  private buildTodayProgramQueue(records: SponsorRecord[], now: number): SponsorRecord[] {
    const windowStart = this.beijingNoonWindowStart(now);
    const windowEnd = windowStart + DAY_MS;

    return records
      .filter((record) => !this.isDeleted(record))
      .filter((record) => !record.hiddenFromTodayAt)
      .filter((record) => record.createdAt >= windowStart && record.createdAt < windowEnd)
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  private beijingNoonWindowStart(now: number): number {
    const shanghaiNow = new Date(now + SHANGHAI_UTC_OFFSET_MS);
    const noonUtc = Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate(),
      4,
      0,
      0,
      0
    );

    return now >= noonUtc ? noonUtc : noonUtc - DAY_MS;
  }

  private buildRanking(records: SponsorRecord[], now: number): SponsorRankingItem[] {
    const rankingMap = new Map<string, SponsorRankingItem & { avatarAt?: number }>();
    const cutoff = now - RECENT_RANKING_WINDOW_MS;

    for (const record of records) {
      if (this.isDeleted(record) || record.createdAt < cutoff) {
        continue;
      }

      const current = rankingMap.get(record.bossName);
      if (current) {
        current.totalAmount = this.roundAmount(current.totalAmount + record.amount);
        current.recordCount += 1;
        current.latestAt = Math.max(current.latestAt, record.createdAt);
        if (record.avatarUrl && (!current.avatarAt || record.createdAt >= current.avatarAt)) {
          current.avatarUrl = record.avatarUrl;
          current.avatarAt = record.createdAt;
        }
        continue;
      }

      rankingMap.set(record.bossName, {
        bossName: record.bossName,
        totalAmount: record.amount,
        recordCount: 1,
        latestAt: record.createdAt,
        avatarUrl: record.avatarUrl,
        avatarAt: record.avatarUrl ? record.createdAt : undefined
      });
    }

    return [...rankingMap.values()].map(({ avatarAt: _avatarAt, ...item }) => item).sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }
      return right.latestAt - left.latestAt;
    });
  }

  private async backfillMissingBossAvatars(
    records: SponsorRecord[],
    bossName: string,
    avatarDataUrl: string | undefined
  ): Promise<SponsorRecord[]> {
    if (!avatarDataUrl || !this.options.avatarStorage) {
      return records;
    }

    const normalizedBossName = this.normalizedBossName(bossName);
    return Promise.all(
      records.map(async (record) => {
        if (this.isDeleted(record) || record.avatarUrl || this.normalizedBossName(record.bossName) !== normalizedBossName) {
          return record;
        }

        return {
          ...record,
          avatarUrl: await this.options.avatarStorage?.saveAvatar(this.roomSlug(), record.id, avatarDataUrl)
        };
      })
    );
  }

  private normalizedBossName(name: string): string {
    return name.trim().toLocaleLowerCase("zh-CN");
  }

  private activeRecords(records: SponsorRecord[]): SponsorRecord[] {
    return records.filter((record) => !this.isDeleted(record));
  }

  private isDeleted(record: SponsorRecord): boolean {
    return Number.isFinite(record.deletedAt);
  }

  private roomSlug(): string {
    return this.options.roomSlug ?? "default";
  }

  private sanitizeAmount(amount: number | undefined): number {
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return 0;
    }

    return this.roundAmount(nextAmount);
  }

  private roundAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}
