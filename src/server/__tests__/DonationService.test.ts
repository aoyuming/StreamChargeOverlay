import { afterEach, describe, expect, it, vi } from "vitest";
import type { SponsorRecord } from "../../shared/types";
import { DonationService } from "../services/DonationService";
import { MemoryStateRepository } from "./MemoryStateRepository";

const baseRecord = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
  id: "seed-1",
  bossName: "赛丽亚老板",
  amount: 100,
  programName: "点将一号位",
  note: "",
  countsTowardCharge: true,
  createdAt: 1,
  ...overrides
});

describe("DonationService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a sponsor record and computes total progress", async () => {
    const service = new DonationService(new MemoryStateRepository());

    const state = await service.addSponsor({
      bossName: "旭旭老板",
      amount: 260,
      programName: "红眼竞速",
      countsTowardCharge: true,
      note: "第一轮"
    });

    expect(state.totalAmount).toBe(260);
    expect(state.goalReached).toBe(false);
    expect(state.sponsors).toHaveLength(1);
    expect(state.programQueue[0]?.programName).toBe("红眼竞速");
  });

  it("keeps non-charge sponsors visible without increasing current charge", async () => {
    const service = new DonationService(new MemoryStateRepository());

    const state = await service.addSponsor({
      bossName: "Program Boss",
      amount: 260,
      programName: "Show only",
      countsTowardCharge: false,
      note: "not startup charge"
    });

    expect(state.totalAmount).toBe(0);
    expect(state.progressPercent).toBe(0);
    expect(state.sponsors[0]?.countsTowardCharge).toBe(false);
    expect(state.programQueue.map((record) => record.programName)).toEqual(["Show only"]);
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

  it("starts dianjiang by subtracting the target amount from current charge", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 500,
      sponsors: [baseRecord({ id: "charge", amount: 900 })]
    });

    const state = await new DonationService(repository).startDianjiang();

    expect(state.totalAmount).toBe(400);
    expect(state.chargeConsumedAmount).toBe(500);
    expect(state.sponsors.map((record) => [record.id, record.amount])).toEqual([["charge", 900]]);
  });

  it("starts dianjiang by zeroing current charge when it is below the target", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 500,
      sponsors: [baseRecord({ id: "charge", amount: 240 })]
    });

    const state = await new DonationService(repository).startDianjiang();

    expect(state.totalAmount).toBe(0);
    expect(state.chargeConsumedAmount).toBe(240);
  });

  it("edits a historical sponsor amount and recalculates charge and ranking", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [
        baseRecord({ id: "edit-me", bossName: "Boss A", amount: 120, createdAt: 1 }),
        baseRecord({ id: "other", bossName: "Boss B", amount: 260, createdAt: 2, countsTowardCharge: false })
      ]
    });

    const state = await new DonationService(repository).updateSponsorAmount("edit-me", 420);

    expect(state.sponsors.find((record) => record.id === "edit-me")?.amount).toBe(420);
    expect(state.totalAmount).toBe(420);
    expect(state.ranking.map((item) => [item.bossName, item.totalAmount])).toEqual([
      ["Boss A", 420],
      ["Boss B", 260]
    ]);
  });

  it("removes a sponsor from the today program list without changing charge or ranking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 4, 5, 0, 0)));
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [baseRecord({ id: "visible", bossName: "Boss A", amount: 300, createdAt: Date.UTC(2026, 5, 4, 4, 30, 0) })]
    });

    const state = await new DonationService(repository).removeSponsorFromToday("visible");

    expect(state.totalAmount).toBe(300);
    expect(state.ranking.map((item) => [item.bossName, item.totalAmount])).toEqual([["Boss A", 300]]);
    expect(state.sponsors.find((record) => record.id === "visible")?.hiddenFromTodayAt).toBe(Date.UTC(2026, 5, 4, 5, 0, 0));
    expect(state.programQueue).toEqual([]);
  });

  it("keeps the today program list on a Beijing noon-to-noon window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 4, 3, 59, 0)));
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [
        baseRecord({ id: "previous-window", createdAt: Date.UTC(2026, 5, 3, 3, 59, 0) }),
        baseRecord({ id: "current-window", createdAt: Date.UTC(2026, 5, 3, 4, 1, 0) }),
        baseRecord({ id: "hidden", createdAt: Date.UTC(2026, 5, 3, 4, 2, 0), hiddenFromTodayAt: Date.UTC(2026, 5, 3, 5, 0, 0) })
      ]
    });

    const state = await new DonationService(repository).getState();

    expect(state.programQueue.map((record) => record.id)).toEqual(["current-window"]);
  });

  it("removes every currently visible today sponsor from the program list", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 4, 5, 0, 0)));
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [
        baseRecord({ id: "visible-a", createdAt: Date.UTC(2026, 5, 4, 4, 5, 0) }),
        baseRecord({ id: "visible-b", createdAt: Date.UTC(2026, 5, 4, 4, 10, 0) }),
        baseRecord({ id: "old", createdAt: Date.UTC(2026, 5, 3, 3, 0, 0) })
      ]
    });

    const state = await new DonationService(repository).removeTodaySponsors();

    expect(state.programQueue).toEqual([]);
    expect(state.sponsors.filter((record) => record.hiddenFromTodayAt).map((record) => record.id)).toEqual([
      "visible-a",
      "visible-b"
    ]);
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
      service.addSponsor({ bossName: " ", amount: 0, programName: " ", countsTowardCharge: true, note: "" })
    ).rejects.toThrow("老板名、节目名和赞助金额都必须填写正确");
  });
});
