import type {
  AddSponsorRequest,
  AppState,
  DerivedAppState,
  SponsorRankingItem,
  SponsorRecord,
  StateRepository,
  UpdateSettingsRequest
} from "../../shared/types";

const DEFAULT_TARGET_AMOUNT = 1000;
const DEFAULT_SLOGAN = "赞助点将，名场面马上开演";

// 业务服务只关心“赞助数据如何变化”，不直接处理 HTTP、文件或页面逻辑。
export class DonationService {
  public constructor(private readonly repository: StateRepository) {}

  public async getState(): Promise<DerivedAppState> {
    const state = await this.repository.load();
    return this.deriveState(this.normalizeState(state));
  }

  public async addSponsor(request: AddSponsorRequest): Promise<DerivedAppState> {
    const bossName = request.bossName.trim();
    const programName = request.programName.trim();
    const amount = Number(request.amount);

    if (!bossName || !programName || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("老板名、节目名和赞助金额都必须填写正确");
    }

    const state = this.normalizeState(await this.repository.load());
    const nextRecord: SponsorRecord = {
      id: crypto.randomUUID(),
      bossName,
      amount: Math.round(amount * 100) / 100,
      programName,
      note: request.note?.trim() ?? "",
      createdAt: Date.now()
    };

    const nextState: AppState = {
      ...state,
      sponsors: [...state.sponsors, nextRecord]
    };

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async deleteSponsor(id: string): Promise<DerivedAppState> {
    const state = this.normalizeState(await this.repository.load());
    const nextState: AppState = {
      ...state,
      sponsors: state.sponsors.filter((record) => record.id !== id)
    };

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  public async updateTargetAmount(targetAmount: number): Promise<DerivedAppState> {
    const nextTargetAmount = Number(targetAmount);
    if (!Number.isFinite(nextTargetAmount) || nextTargetAmount <= 0) {
      throw new Error("目标金额必须大于 0");
    }

    const state = this.normalizeState(await this.repository.load());
    const nextState: AppState = {
      ...state,
      targetAmount: Math.round(nextTargetAmount * 100) / 100
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

    const state = this.normalizeState(await this.repository.load());
    const nextState: AppState = {
      ...state,
      targetAmount: Math.round(nextTargetAmount * 100) / 100,
      slogan: nextSlogan
    };

    await this.repository.save(nextState);
    return this.deriveState(nextState);
  }

  private normalizeState(state: AppState): AppState {
    return {
      targetAmount: state.targetAmount > 0 ? state.targetAmount : DEFAULT_TARGET_AMOUNT,
      slogan: state.slogan?.trim() || DEFAULT_SLOGAN,
      sponsors: Array.isArray(state.sponsors) ? state.sponsors : []
    };
  }

  private deriveState(state: AppState): DerivedAppState {
    const totalAmount = state.sponsors.reduce((sum, record) => sum + record.amount, 0);
    const progressPercent = Math.min(100, Math.round((totalAmount / state.targetAmount) * 10000) / 100);

    return {
      ...state,
      totalAmount: Math.round(totalAmount * 100) / 100,
      progressPercent,
      goalReached: totalAmount >= state.targetAmount,
      ranking: this.buildRanking(state.sponsors),
      programQueue: [...state.sponsors].sort((left, right) => left.createdAt - right.createdAt)
    };
  }

  private buildRanking(records: SponsorRecord[]): SponsorRankingItem[] {
    const rankingMap = new Map<string, SponsorRankingItem>();

    for (const record of records) {
      const current = rankingMap.get(record.bossName);
      if (current) {
        current.totalAmount = Math.round((current.totalAmount + record.amount) * 100) / 100;
        current.recordCount += 1;
        current.latestAt = Math.max(current.latestAt, record.createdAt);
        continue;
      }

      rankingMap.set(record.bossName, {
        bossName: record.bossName,
        totalAmount: record.amount,
        recordCount: 1,
        latestAt: record.createdAt
      });
    }

    return [...rankingMap.values()].sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }
      return right.latestAt - left.latestAt;
    });
  }
}
