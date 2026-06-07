import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStateRepository } from "../repositories/JsonStateRepository";

const createJsonPath = async () => {
  const directory = await mkdtemp(join(tmpdir(), "sponsor-json-state-"));
  return join(directory, "state.json");
};

describe("JsonStateRepository", () => {
  it("loads legacy state with charge defaults", async () => {
    const filePath = await createJsonPath();
    await writeFile(
      filePath,
      JSON.stringify({
        targetAmount: 1500,
        slogan: "legacy slogan",
        sponsors: [{ id: "legacy-1", bossName: "legacy boss", amount: 300, programName: "legacy", note: "", createdAt: 3 }]
      }),
      "utf8"
    );

    const state = await new JsonStateRepository(filePath).load();

    expect(state.chargeConsumedAmount).toBe(0);
    expect(state.chargeAdjustmentAmount).toBe(0);
    expect(state.lastDianjiangEffectAt).toBeUndefined();
    expect(state.sponsors[0]).toMatchObject({ id: "legacy-1", countsTowardCharge: true });
    expect(state.sponsors[0]?.avatarUrl).toBeUndefined();
  });

  it("preserves sponsor avatar urls when loading JSON state", async () => {
    const filePath = await createJsonPath();
    await writeFile(
      filePath,
      JSON.stringify({
        sponsors: [
          {
            id: "avatar-1",
            bossName: "avatar boss",
            amount: 300,
            programName: "avatar program",
            note: "",
            createdAt: 3,
            avatarUrl: "/avatars/default/avatar-1.webp"
          }
        ]
      }),
      "utf8"
    );

    const state = await new JsonStateRepository(filePath).load();

    expect(state.sponsors[0]?.avatarUrl).toBe("/avatars/default/avatar-1.webp");
  });

  it("preserves recycle-bin timestamps when loading JSON state", async () => {
    const filePath = await createJsonPath();
    await writeFile(
      filePath,
      JSON.stringify({
        sponsors: [
          {
            id: "trash-1",
            bossName: "trash boss",
            amount: 300,
            programName: "trash program",
            note: "",
            createdAt: 3,
            deletedAt: 1717560000000
          }
        ]
      }),
      "utf8"
    );

    const state = await new JsonStateRepository(filePath).load();

    expect(state.sponsors[0]?.deletedAt).toBe(1717560000000);
  });
});
