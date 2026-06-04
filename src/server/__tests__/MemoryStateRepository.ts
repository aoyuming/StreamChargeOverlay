import type { AppState, StateRepository } from "../../shared/types";

export class MemoryStateRepository implements StateRepository {
  private state: AppState;

  public constructor(initialState?: Partial<AppState>) {
    this.state = {
      targetAmount: initialState?.targetAmount ?? 1000,
      slogan: initialState?.slogan ?? "赞助点将，名场面马上开演",
      chargeConsumedAmount: initialState?.chargeConsumedAmount ?? 0,
      sponsors: initialState?.sponsors ?? []
    };
  }

  public async load(): Promise<AppState> {
    return structuredClone(this.state);
  }

  public async save(state: AppState): Promise<void> {
    this.state = structuredClone(state);
  }
}
