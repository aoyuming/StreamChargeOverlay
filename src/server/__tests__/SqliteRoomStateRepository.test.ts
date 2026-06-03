import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteRoomStateRepository } from "../repositories/SqliteRoomStateRepository";

const tempFiles: string[] = [];

const createDatabasePath = async () => {
  const directory = await mkdtemp(join(tmpdir(), "sponsor-room-db-"));
  const databasePath = join(directory, "app.sqlite");
  tempFiles.push(databasePath);
  return databasePath;
};

describe("SqliteRoomStateRepository", () => {
  afterEach(() => {
    for (const filePath of tempFiles.splice(0)) {
      SqliteRoomStateRepository.closeDatabase(filePath);
    }
  });

  it("creates and reads the default room when the database is empty", async () => {
    const repository = await SqliteRoomStateRepository.open(await createDatabasePath(), "default");

    const state = await repository.load();

    expect(state.targetAmount).toBe(1000);
    expect(state.sponsors).toEqual([]);
  });

  it("keeps room state isolated by room slug", async () => {
    const databasePath = await createDatabasePath();
    const alpha = await SqliteRoomStateRepository.open(databasePath, "alpha");
    const beta = await SqliteRoomStateRepository.open(databasePath, "beta");

    await alpha.save({
      targetAmount: 1200,
      slogan: "alpha slogan",
      sponsors: [{ id: "alpha-1", bossName: "alpha boss", amount: 100, programName: "alpha", note: "", createdAt: 1 }]
    });
    await beta.save({
      targetAmount: 800,
      slogan: "beta slogan",
      sponsors: [{ id: "beta-1", bossName: "beta boss", amount: 200, programName: "beta", note: "", createdAt: 2 }]
    });

    await expect(alpha.load()).resolves.toMatchObject({ targetAmount: 1200, slogan: "alpha slogan" });
    await expect(beta.load()).resolves.toMatchObject({ targetAmount: 800, slogan: "beta slogan" });
    expect((await alpha.load()).sponsors.map((record) => record.id)).toEqual(["alpha-1"]);
    expect((await beta.load()).sponsors.map((record) => record.id)).toEqual(["beta-1"]);
  });

  it("migrates legacy JSON data into the default room once", async () => {
    const databasePath = await createDatabasePath();
    const legacyPath = join(tmpdir(), `legacy-${crypto.randomUUID()}.json`);
    await writeFile(
      legacyPath,
      JSON.stringify({
        targetAmount: 1500,
        slogan: "legacy slogan",
        sponsors: [{ id: "legacy-1", bossName: "legacy boss", amount: 300, programName: "legacy", note: "", createdAt: 3 }]
      }),
      "utf8"
    );

    const repository = await SqliteRoomStateRepository.open(databasePath, "default", { legacyJsonPath: legacyPath });
    const state = await repository.load();

    expect(state.targetAmount).toBe(1500);
    expect(state.slogan).toBe("legacy slogan");
    expect(state.sponsors.map((record) => record.id)).toEqual(["legacy-1"]);
    expect(await readFile(legacyPath, "utf8")).toContain("legacy-1");
  });
});
