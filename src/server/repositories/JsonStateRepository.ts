import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AppState, StateRepository } from "../../shared/types";

const EMPTY_STATE: AppState = {
  targetAmount: 1000,
  slogan: "赞助点将，名场面马上开演",
  sponsors: []
};

// 本地 demo 用 JSON 文件做持久化，方便用户直接看到数据长什么样。
export class JsonStateRepository implements StateRepository {
  public constructor(private readonly filePath: string) {}

  public async load(): Promise<AppState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppState>;

      return {
        targetAmount: typeof parsed.targetAmount === "number" ? parsed.targetAmount : EMPTY_STATE.targetAmount,
        slogan: typeof parsed.slogan === "string" ? parsed.slogan : EMPTY_STATE.slogan,
        sponsors: Array.isArray(parsed.sponsors) ? parsed.sponsors : []
      };
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

  private isFileMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}
