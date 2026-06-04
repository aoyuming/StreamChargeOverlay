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
    expect(state.lastDianjiangEffectAt).toBeUndefined();
    expect(state.sponsors[0]).toMatchObject({ id: "legacy-1", countsTowardCharge: true });
  });
});
