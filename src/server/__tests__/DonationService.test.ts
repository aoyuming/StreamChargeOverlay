import { describe, expect, it } from "vitest";
import type { SponsorRecord } from "../../shared/types";
import { DonationService } from "../services/DonationService";
import { MemoryStateRepository } from "./MemoryStateRepository";

const baseRecord = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
  id: "seed-1",
  bossName: "赛丽亚老板",
  amount: 100,
  programName: "点将一号位",
  note: "",
  createdAt: 1,
  ...overrides
});

describe("DonationService", () => {
  it("adds a sponsor record and computes total progress", async () => {
    const service = new DonationService(new MemoryStateRepository());

    const state = await service.addSponsor({
      bossName: "旭旭老板",
      amount: 260,
      programName: "红眼竞速",
      note: "第一轮"
    });

    expect(state.totalAmount).toBe(260);
    expect(state.goalReached).toBe(false);
    expect(state.sponsors).toHaveLength(1);
    expect(state.programQueue[0]?.programName).toBe("红眼竞速");
  });

  it("sorts the sponsor ranking by accumulated boss amount", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [
        baseRecord({ id: "a", bossName: "老板A", amount: 100, createdAt: 1 }),
        baseRecord({ id: "b", bossName: "老板B", amount: 260, createdAt: 2 }),
        baseRecord({ id: "c", bossName: "老板A", amount: 300, createdAt: 3 })
      ]
    });

    const state = await new DonationService(repository).getState();

    expect(state.ranking.map((item) => [item.bossName, item.totalAmount])).toEqual([
      ["老板A", 400],
      ["老板B", 260]
    ]);
  });

  it("marks the goal as reached when total amount meets the target", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 500,
      sponsors: [baseRecord({ amount: 500 })]
    });

    const state = await new DonationService(repository).getState();

    expect(state.totalAmount).toBe(500);
    expect(state.goalReached).toBe(true);
  });

  it("updates the target amount and configurable display slogan", async () => {
    const service = new DonationService(new MemoryStateRepository());

    const state = await service.updateSettings({
      targetAmount: 1200,
      slogan: "赞助点将，名场面马上开演"
    });

    expect(state.targetAmount).toBe(1200);
    expect(state.slogan).toBe("赞助点将，名场面马上开演");
  });

  it("deletes a sponsor record and recomputes derived state", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 300,
      sponsors: [
        baseRecord({ id: "keep", amount: 120, createdAt: 1 }),
        baseRecord({ id: "delete-me", amount: 220, createdAt: 2 })
      ]
    });
    const service = new DonationService(repository);

    const state = await service.deleteSponsor("delete-me");

    expect(state.totalAmount).toBe(120);
    expect(state.goalReached).toBe(false);
    expect(state.sponsors.map((item) => item.id)).toEqual(["keep"]);
  });

  it("rejects empty names and non-positive amounts", async () => {
    const service = new DonationService(new MemoryStateRepository());

    await expect(
      service.addSponsor({ bossName: " ", amount: 0, programName: " ", note: "" })
    ).rejects.toThrow("老板名、节目名和赞助金额都必须填写正确");
  });
});
