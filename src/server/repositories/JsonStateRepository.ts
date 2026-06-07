import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AppState, SponsorRecord, StateRepository } from "../../shared/types";

const EMPTY_STATE: AppState = {
  targetAmount: 1000,
  slogan: "赞助点将，名场面马上开演",
  chargeConsumedAmount: 0,
  chargeAdjustmentAmount: 0,
  lastDianjiangEffectAt: undefined,
  sponsors: []
};

// Local demo persistence keeps the whole room state readable in one JSON file.
export class JsonStateRepository implements StateRepository {
  public constructor(private readonly filePath: string) {}

  public async load(): Promise<AppState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppState>;

      return this.normalizeState(parsed);
    } catch (error) {
      if (this.isFileMissing(error)) {
        await this.save(EMPTY_STATE);
        return structuredClone(EMPTY_STATE);
      }
      throw error;
    }
  }

  public async save(state: AppState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private normalizeState(state: Partial<AppState>): AppState {
    return {
      targetAmount: typeof state.targetAmount === "number" ? state.targetAmount : EMPTY_STATE.targetAmount,
      slogan: typeof state.slogan === "string" ? state.slogan : EMPTY_STATE.slogan,
      chargeConsumedAmount:
        typeof state.chargeConsumedAmount === "number" ? state.chargeConsumedAmount : EMPTY_STATE.chargeConsumedAmount,
      chargeAdjustmentAmount:
        typeof state.chargeAdjustmentAmount === "number" ? state.chargeAdjustmentAmount : EMPTY_STATE.chargeAdjustmentAmount,
      lastDianjiangEffectAt:
        typeof state.lastDianjiangEffectAt === "number" ? state.lastDianjiangEffectAt : undefined,
      sponsors: Array.isArray(state.sponsors) ? state.sponsors.map((record) => this.normalizeRecord(record)) : []
    };
  }

  private normalizeRecord(record: SponsorRecord): SponsorRecord {
    return {
      ...record,
      note: record.note ?? "",
      countsTowardCharge: record.countsTowardCharge !== false,
      avatarUrl: typeof record.avatarUrl === "string" && record.avatarUrl.trim() ? record.avatarUrl : undefined,
      hiddenFromTodayAt: Number.isFinite(record.hiddenFromTodayAt) ? record.hiddenFromTodayAt : undefined,
      deletedAt: Number.isFinite(record.deletedAt) ? record.deletedAt : undefined
    };
  }

  private isFileMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}
