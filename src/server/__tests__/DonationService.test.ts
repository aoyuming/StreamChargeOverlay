import { afterEach, describe, expect, it, vi } from "vitest";
import type { SponsorRecord } from "../../shared/types";
import { STARTUP_FUNDING_PROGRAM_NAME } from "../../shared/displayUnits";
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

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_RANKING_WINDOW_MS = 60 * DAY_MS;
const TRASH_RETENTION_MS = 7 * DAY_MS;

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
    expect(state.programQueue[0]?.programName).toBe(STARTUP_FUNDING_PROGRAM_NAME);
  });

  it("stores a compressed avatar for a new sponsor when avatar data is provided", async () => {
    const avatarStorage = {
      clearAvatar: vi.fn(),
      saveAvatar: vi.fn(async (roomSlug: string, sponsorId: string) => `/avatars/${roomSlug}/${sponsorId}.webp`)
    };
    const service = new (DonationService as any)(new MemoryStateRepository(), {
      avatarStorage,
      roomSlug: "alpha"
    });

    const state = await service.addSponsor({
      bossName: "Avatar Boss",
      amount: 260,
      programName: "startup",
      avatarDataUrl: "data:image/webp;base64,avatar"
    });

    const record = state.sponsors[0];
    expect(avatarStorage.saveAvatar).toHaveBeenCalledWith("alpha", record?.id, "data:image/webp;base64,avatar");
    expect(record?.avatarUrl).toBe(`/avatars/alpha/${record?.id}.webp`);
  });

  it("backfills missing avatars on older records with the same boss name when a new avatar is added", async () => {
    const avatarStorage = {
      clearAvatar: vi.fn(),
      saveAvatar: vi.fn(async (roomSlug: string, sponsorId: string) => `/avatars/${roomSlug}/${sponsorId}.webp`)
    };
    const repository = new MemoryStateRepository({
      sponsors: [
        baseRecord({ id: "old-missing", bossName: "Same Boss", createdAt: 1 }),
        baseRecord({ id: "old-existing", bossName: "Same Boss", avatarUrl: "/avatars/alpha/existing.webp", createdAt: 2 } as any),
        baseRecord({ id: "other-missing", bossName: "Other Boss", createdAt: 3 })
      ]
    });
    const service = new (DonationService as any)(repository, {
      avatarStorage,
      roomSlug: "alpha"
    });

    const state = await service.addSponsor({
      bossName: "Same Boss",
      amount: 260,
      programName: "startup",
      avatarDataUrl: "data:image/webp;base64,avatar"
    });

    expect(state.sponsors.find((record: SponsorRecord) => record.id === "old-missing")?.avatarUrl).toBe(
      "/avatars/alpha/old-missing.webp"
    );
    expect(state.sponsors.find((record: SponsorRecord) => record.id === "old-existing")?.avatarUrl).toBe(
      "/avatars/alpha/existing.webp"
    );
    expect(state.sponsors.find((record: SponsorRecord) => record.id === "other-missing")?.avatarUrl).toBeUndefined();
    expect(avatarStorage.saveAvatar).toHaveBeenCalledWith("alpha", "old-missing", "data:image/webp;base64,avatar");
  });

  it("updates and clears a historical sponsor avatar without changing the amount", async () => {
    const avatarStorage = {
      clearAvatar: vi.fn(),
      saveAvatar: vi.fn(async (roomSlug: string, sponsorId: string) => `/avatars/${roomSlug}/${sponsorId}.png`)
    };
    const repository = new MemoryStateRepository({
      sponsors: [baseRecord({ id: "avatar-record", amount: 520, avatarUrl: "/avatars/alpha/avatar-record.webp" } as any)]
    });
    const service = new (DonationService as any)(repository, {
      avatarStorage,
      roomSlug: "alpha"
    });

    const updated = await service.updateSponsorAvatar("avatar-record", "data:image/png;base64,next");
    const cleared = await service.updateSponsorAvatar("avatar-record", null);

    expect(updated.sponsors[0]?.avatarUrl).toBe("/avatars/alpha/avatar-record.png");
    expect(cleared.sponsors[0]?.avatarUrl).toBeUndefined();
    expect(cleared.sponsors[0]?.amount).toBe(520);
    expect(avatarStorage.clearAvatar).toHaveBeenCalledWith("/avatars/alpha/avatar-record.png");
  });

  it("updates every editable sponsor field and recalculates startup charge", async () => {
    const createdAt = new Date("2026-06-05T20:30:00+08:00").getTime();
    const repository = new MemoryStateRepository({
      sponsors: [
        baseRecord({ id: "edit-me", bossName: "Old Boss", amount: 120, programName: "Old Program", note: "old note", countsTowardCharge: false, createdAt: 1 })
      ]
    });
    const service = new DonationService(repository);

    const state = await service.updateSponsor("edit-me", {
      bossName: "New Boss",
      amount: 260.129,
      programName: "New Program",
      note: "new note",
      countsTowardCharge: true,
      createdAt
    });
    const stored = await repository.load();

    expect(state.sponsors[0]).toMatchObject({
      bossName: "New Boss",
      amount: 260.13,
      programName: "New Program",
      note: "new note",
      countsTowardCharge: true,
      createdAt
    });
    expect(state.totalAmount).toBe(260.13);
    expect(stored.sponsors[0]).toMatchObject(state.sponsors[0] as SponsorRecord);
  });

  it("rejects invalid full sponsor edits", async () => {
    const service = new DonationService(new MemoryStateRepository({ sponsors: [baseRecord({ id: "edit-me" })] }));
    const valid = { bossName: "Boss", amount: 100, programName: "Program", note: "", countsTowardCharge: true, createdAt: 1 };

    await expect(service.updateSponsor("edit-me", { ...valid, bossName: " " })).rejects.toThrow();
    await expect(service.updateSponsor("edit-me", { ...valid, programName: " " })).rejects.toThrow();
    await expect(service.updateSponsor("edit-me", { ...valid, amount: 0 })).rejects.toThrow();
    await expect(service.updateSponsor("edit-me", { ...valid, createdAt: Number.NaN })).rejects.toThrow();
  });

  it("keeps, clears, or replaces avatars during full sponsor edits", async () => {
    const avatarStorage = {
      clearAvatar: vi.fn(),
      saveAvatar: vi.fn(async (roomSlug: string, sponsorId: string) => `/avatars/${roomSlug}/${sponsorId}.webp`)
    };
    const repository = new MemoryStateRepository({
      sponsors: [baseRecord({ id: "avatar-edit", avatarUrl: "/avatars/alpha/old.webp" } as any)]
    });
    const service = new (DonationService as any)(repository, {
      avatarStorage,
      roomSlug: "alpha"
    });
    const request = { bossName: "Avatar Boss", amount: 100, programName: "Avatar Program", note: "", countsTowardCharge: true, createdAt: 1 };

    const kept = await service.updateSponsor("avatar-edit", request);
    const cleared = await service.updateSponsor("avatar-edit", { ...request, avatarDataUrl: null });
    const replaced = await service.updateSponsor("avatar-edit", { ...request, avatarDataUrl: "data:image/webp;base64,next" });

    expect(kept.sponsors[0]?.avatarUrl).toBe("/avatars/alpha/old.webp");
    expect(cleared.sponsors[0]?.avatarUrl).toBeUndefined();
    expect(replaced.sponsors[0]?.avatarUrl).toBe("/avatars/alpha/avatar-edit.webp");
    expect(avatarStorage.clearAvatar).toHaveBeenCalledWith("/avatars/alpha/old.webp");
    expect(avatarStorage.saveAvatar).toHaveBeenCalledWith("alpha", "avatar-edit", "data:image/webp;base64,next");
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

  it("stores startup charge sponsors as startup funding programs", async () => {
    const service = new DonationService(new MemoryStateRepository());

    const state = await service.addSponsor({
      bossName: "Charge Boss",
      amount: 260,
      programName: "should be replaced",
      countsTowardCharge: true,
      note: ""
    });

    expect(state.sponsors[0]?.programName).toBe(STARTUP_FUNDING_PROGRAM_NAME);
    expect(state.programQueue[0]?.programName).toBe(STARTUP_FUNDING_PROGRAM_NAME);
  });

  it("sorts the sponsor ranking by accumulated boss amount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10);
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

  it("builds the display ranking from the last 60 days without deleting older records", async () => {
    const now = new Date("2026-06-05T12:00:00+08:00").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [
        baseRecord({ id: "recent-a", bossName: "Boss A", amount: 100, createdAt: now - RECENT_RANKING_WINDOW_MS }),
        baseRecord({ id: "expired-a", bossName: "Boss A", amount: 900, createdAt: now - RECENT_RANKING_WINDOW_MS - 1 }),
        baseRecord({ id: "recent-c", bossName: "Boss C", amount: 300, createdAt: now - DAY_MS }),
        baseRecord({ id: "old-b", bossName: "Boss B", amount: 500, createdAt: now - RECENT_RANKING_WINDOW_MS - DAY_MS })
      ]
    });

    const state = await new DonationService(repository).getState();

    expect(state.sponsors.map((record) => record.id)).toEqual(["recent-a", "expired-a", "recent-c", "old-b"]);
    expect(state.ranking.map((item) => [item.bossName, item.totalAmount])).toEqual([
      ["Boss C", 300],
      ["Boss A", 100]
    ]);
  });

  it("uses the latest available avatar from records inside the recent ranking window", async () => {
    const now = new Date("2026-06-05T12:00:00+08:00").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const repository = new MemoryStateRepository({
      sponsors: [
        baseRecord({
          id: "old-avatar",
          bossName: "Boss A",
          amount: 800,
          avatarUrl: "/avatars/old.webp",
          createdAt: now - RECENT_RANKING_WINDOW_MS - 1
        } as any),
        baseRecord({
          id: "recent-old-avatar",
          bossName: "Boss A",
          amount: 100,
          avatarUrl: "/avatars/recent-old.webp",
          createdAt: now - 3 * DAY_MS
        } as any),
        baseRecord({ id: "recent-no-avatar", bossName: "Boss A", amount: 100, createdAt: now - 2 * DAY_MS }),
        baseRecord({
          id: "recent-new-avatar",
          bossName: "Boss A",
          amount: 200,
          avatarUrl: "/avatars/recent-new.webp",
          createdAt: now - DAY_MS
        } as any)
      ]
    });

    const state = await new DonationService(repository).getState();

    expect(state.ranking).toEqual([
      expect.objectContaining({
        bossName: "Boss A",
        totalAmount: 400,
        avatarUrl: "/avatars/recent-new.webp"
      })
    ]);
  });

  it("uses the latest available sponsor avatar in the total ranking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10);
    const repository = new MemoryStateRepository({
      sponsors: [
        baseRecord({ id: "a", bossName: "Boss A", amount: 100, avatarUrl: "/avatars/a-old.webp", createdAt: 1 } as any),
        baseRecord({ id: "b", bossName: "Boss A", amount: 200, createdAt: 2 }),
        baseRecord({ id: "c", bossName: "Boss A", amount: 300, avatarUrl: "/avatars/a-new.webp", createdAt: 3 } as any)
      ]
    });

    const state = await new DonationService(repository).getState();

    expect(state.ranking[0]).toMatchObject({
      bossName: "Boss A",
      totalAmount: 600,
      avatarUrl: "/avatars/a-new.webp"
    });
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:30:00+08:00"));
    const repository = new MemoryStateRepository({
      targetAmount: 500,
      sponsors: [baseRecord({ id: "charge", amount: 900 })]
    });

    const state = await new DonationService(repository).startDianjiang();

    expect(state.totalAmount).toBe(400);
    expect(state.chargeConsumedAmount).toBe(500);
    expect(state.lastDianjiangEffectAt).toBe(new Date("2026-06-04T12:30:00+08:00").getTime());
    expect(state.sponsors.map((record) => [record.id, record.amount])).toEqual([["charge", 900]]);
  });

  it("starts dianjiang by zeroing current charge when it is below the target", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:35:00+08:00"));
    const repository = new MemoryStateRepository({
      targetAmount: 500,
      sponsors: [baseRecord({ id: "charge", amount: 240 })]
    });

    const state = await new DonationService(repository).startDianjiang();

    expect(state.totalAmount).toBe(0);
    expect(state.chargeConsumedAmount).toBe(240);
    expect(state.lastDianjiangEffectAt).toBe(new Date("2026-06-04T12:35:00+08:00").getTime());
  });

  it("does not emit a dianjiang effect marker when current charge is already zero", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:40:00+08:00"));
    const repository = new MemoryStateRepository({
      targetAmount: 500,
      sponsors: [baseRecord({ id: "spent", amount: 240 })],
      chargeConsumedAmount: 240,
      lastDianjiangEffectAt: new Date("2026-06-04T12:00:00+08:00").getTime()
    });

    const state = await new DonationService(repository).startDianjiang();

    expect(state.totalAmount).toBe(0);
    expect(state.chargeConsumedAmount).toBe(240);
    expect(state.lastDianjiangEffectAt).toBe(new Date("2026-06-04T12:00:00+08:00").getTime());
  });

  it("sets current startup funding without changing sponsor records or rankings", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10);
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [
        baseRecord({ id: "charge", bossName: "Charge Boss", amount: 300, createdAt: 1 }),
        baseRecord({ id: "program", bossName: "Program Boss", amount: 200, countsTowardCharge: false, createdAt: 2 })
      ]
    });
    const service = new DonationService(repository);

    const before = await service.getState();
    const state = await service.updateCurrentChargeAmount(650);
    const stored = await repository.load();

    expect(before.ranking.map((item) => [item.bossName, item.totalAmount])).toEqual([
      ["Charge Boss", 300],
      ["Program Boss", 200]
    ]);
    expect(state.totalAmount).toBe(650);
    expect(state.chargeAdjustmentAmount).toBe(350);
    expect(state.sponsors.map((record) => [record.id, record.amount])).toEqual([
      ["charge", 300],
      ["program", 200]
    ]);
    expect(state.ranking.map((item) => [item.bossName, item.totalAmount])).toEqual(before.ranking.map((item) => [
      item.bossName,
      item.totalAmount
    ]));
    expect(state.programQueue.map((record) => record.id)).toEqual(before.programQueue.map((record) => record.id));
    expect(stored.chargeAdjustmentAmount).toBe(350);
  });

  it("adds future startup funding on top of the manually edited current charge", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 500,
      sponsors: [baseRecord({ id: "charge", amount: 300 })]
    });
    const service = new DonationService(repository);

    await service.updateCurrentChargeAmount(100);
    const afterAdd = await service.addSponsor({
      bossName: "Fresh Boss",
      amount: 80,
      programName: "startup",
      countsTowardCharge: true
    });
    const afterStart = await service.startDianjiang();

    expect(afterAdd.totalAmount).toBe(180);
    expect(afterAdd.chargeAdjustmentAmount).toBe(-200);
    expect(afterStart.totalAmount).toBe(0);
    expect(afterStart.chargeConsumedAmount).toBe(180);
  });

  it("rejects negative current startup funding edits", async () => {
    const service = new DonationService(new MemoryStateRepository());

    await expect(service.updateCurrentChargeAmount(-1)).rejects.toThrow("当前启动资金不能小于 0");
  });

  it("edits a historical sponsor amount and recalculates charge and ranking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10);
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

  it("adds a removed sponsor back to the today program list", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 4, 5, 0, 0)));
    const repository = new MemoryStateRepository({
      targetAmount: 1000,
      sponsors: [
        baseRecord({
          id: "restore",
          amount: 300,
          createdAt: Date.UTC(2026, 5, 4, 4, 30, 0),
          hiddenFromTodayAt: Date.UTC(2026, 5, 4, 4, 45, 0)
        })
      ]
    });

    const state = await new DonationService(repository).addSponsorToToday("restore");

    expect(state.sponsors.find((record) => record.id === "restore")?.hiddenFromTodayAt).toBeUndefined();
    expect(state.programQueue.map((record) => record.id)).toEqual(["restore"]);
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

  it("moves a deleted sponsor record into the recycle bin and recomputes derived state", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-05T12:00:00+08:00").getTime();
    vi.setSystemTime(now);
    const repository = new MemoryStateRepository({
      targetAmount: 300,
      sponsors: [
        baseRecord({ id: "keep", amount: 120, createdAt: now - 2 }),
        baseRecord({ id: "delete-me", bossName: "Deleted Boss", amount: 220, createdAt: now - 1 })
      ]
    });
    const service = new DonationService(repository);

    const state = await service.deleteSponsor("delete-me");
    const stored = await repository.load();

    expect(state.totalAmount).toBe(120);
    expect(state.goalReached).toBe(false);
    expect(state.sponsors.map((item) => item.id)).toEqual(["keep"]);
    expect(state.ranking.map((item) => item.bossName)).toEqual(["赛丽亚老板"]);
    expect(stored.sponsors.map((item) => item.id)).toEqual(["keep", "delete-me"]);
    expect(stored.sponsors.find((item) => item.id === "delete-me")?.deletedAt).toBe(now);
  });

  it("moves all active sponsor records into the recycle bin", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-05T12:05:00+08:00").getTime();
    vi.setSystemTime(now);
    const repository = new MemoryStateRepository({
      targetAmount: 300,
      sponsors: [
        baseRecord({ id: "delete-a", amount: 120, createdAt: now - 3 }),
        baseRecord({ id: "delete-b", amount: 220, createdAt: now - 2 }),
        baseRecord({ id: "existing-trash", amount: 330, deletedAt: now - 100, createdAt: now - 1 } as any)
      ]
    });
    const service = new DonationService(repository);

    const state = await service.deleteAllSponsors();
    const stored = await repository.load();

    expect(state.sponsors).toEqual([]);
    expect(state.totalAmount).toBe(0);
    expect(stored.sponsors.map((record) => [record.id, record.deletedAt])).toEqual([
      ["delete-a", now],
      ["delete-b", now],
      ["existing-trash", now - 100]
    ]);
  });

  it("permanently deletes one recycle-bin record or clears the whole recycle bin", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-05T12:10:00+08:00").getTime();
    vi.setSystemTime(now);
    const avatarStorage = {
      clearAvatar: vi.fn(),
      saveAvatar: vi.fn()
    };
    const repository = new MemoryStateRepository({
      sponsors: [
        baseRecord({ id: "keep", amount: 120, createdAt: 1 }),
        baseRecord({ id: "trash-a", amount: 220, avatarUrl: "/avatars/alpha/trash-a.webp", deletedAt: now - 2, createdAt: 2 } as any),
        baseRecord({ id: "trash-b", amount: 330, avatarUrl: "/avatars/alpha/trash-b.webp", deletedAt: now - 1, createdAt: 3 } as any)
      ]
    });
    const service = new (DonationService as any)(repository, {
      avatarStorage,
      roomSlug: "alpha"
    });

    const afterOne = await service.deleteSponsorPermanently("trash-a");
    const afterClear = await service.clearSponsorTrash();
    const stored = await repository.load();

    expect(afterOne.sponsors.map((record: SponsorRecord) => record.id)).toEqual(["keep"]);
    expect(afterClear.sponsors.map((record: SponsorRecord) => record.id)).toEqual(["keep"]);
    expect(stored.sponsors.map((record) => record.id)).toEqual(["keep"]);
    expect(avatarStorage.clearAvatar).toHaveBeenCalledWith("/avatars/alpha/trash-a.webp");
    expect(avatarStorage.clearAvatar).toHaveBeenCalledWith("/avatars/alpha/trash-b.webp");
  });

  it("purges recycle-bin sponsor records after seven days and clears their avatars", async () => {
    const now = new Date("2026-06-12T12:00:00+08:00").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const avatarStorage = {
      clearAvatar: vi.fn(),
      saveAvatar: vi.fn()
    };
    const repository = new MemoryStateRepository({
      sponsors: [
        baseRecord({ id: "keep", amount: 120, createdAt: 1 }),
        baseRecord({
          id: "expired-trash",
          amount: 220,
          avatarUrl: "/avatars/alpha/expired-trash.webp",
          deletedAt: now - TRASH_RETENTION_MS - 1,
          createdAt: 2
        } as any),
        baseRecord({ id: "fresh-trash", amount: 330, deletedAt: now - TRASH_RETENTION_MS + 1, createdAt: 3 } as any)
      ]
    });
    const service = new (DonationService as any)(repository, {
      avatarStorage,
      roomSlug: "alpha"
    });

    const state = await service.getState();
    const stored = await repository.load();

    expect(state.sponsors.map((item: SponsorRecord) => item.id)).toEqual(["keep"]);
    expect(state.totalAmount).toBe(120);
    expect(stored.sponsors.map((item) => item.id)).toEqual(["keep", "fresh-trash"]);
    expect(avatarStorage.clearAvatar).toHaveBeenCalledWith("/avatars/alpha/expired-trash.webp");
    expect(avatarStorage.clearAvatar).not.toHaveBeenCalledWith(undefined);
  });

  it("lists, edits, and restores recycle-bin sponsor records", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-05T12:00:00+08:00").getTime();
    vi.setSystemTime(now);
    const repository = new MemoryStateRepository({
      sponsors: [
        baseRecord({ id: "keep", amount: 120, createdAt: now - 2 }),
        baseRecord({ id: "trash", bossName: "Trash Boss", amount: 220, deletedAt: now - 1, createdAt: now - 1 } as any)
      ]
    });
    const service = new DonationService(repository);

    const trashBeforeEdit = await service.listTrashSponsors();
    const activeAfterEdit = await service.updateSponsorAmount("trash", 330);
    const trashAfterEdit = await service.listTrashSponsors();
    const activeAfterRestore = await service.restoreSponsor("trash");
    const stored = await repository.load();

    expect(trashBeforeEdit.map((record) => record.id)).toEqual(["trash"]);
    expect(activeAfterEdit.sponsors.map((record) => record.id)).toEqual(["keep"]);
    expect(trashAfterEdit[0]?.amount).toBe(330);
    expect(activeAfterRestore.sponsors.map((record) => record.id)).toEqual(["keep", "trash"]);
    expect(activeAfterRestore.totalAmount).toBe(450);
    expect(activeAfterRestore.restoredSponsorId).toBe("trash");
    expect(stored.sponsors.find((record) => record.id === "trash")?.deletedAt).toBeUndefined();
  });

  it("does not keep deleted startup funding as hidden consumed debt", async () => {
    const repository = new MemoryStateRepository({
      targetAmount: 300,
      chargeConsumedAmount: 300,
      sponsors: [baseRecord({ id: "delete-me", amount: 300, countsTowardCharge: true })]
    });
    const service = new DonationService(repository);

    const afterDelete = await service.deleteSponsor("delete-me");
    const afterNewSponsor = await service.addSponsor({
      bossName: "Fresh Boss",
      amount: 100,
      programName: "startup",
      countsTowardCharge: true
    });

    expect(afterDelete.chargeConsumedAmount).toBe(0);
    expect(afterNewSponsor.totalAmount).toBe(100);
    expect(afterNewSponsor.chargeConsumedAmount).toBe(0);
  });

  it("normalizes old over-consumed charge state before adding new startup funding", async () => {
    const service = new DonationService(
      new MemoryStateRepository({
        chargeConsumedAmount: 300,
        sponsors: []
      })
    );

    const state = await service.addSponsor({
      bossName: "Fresh Boss",
      amount: 100,
      programName: "startup",
      countsTowardCharge: true
    });

    expect(state.totalAmount).toBe(100);
    expect(state.chargeConsumedAmount).toBe(0);
  });

  it("rejects empty names and non-positive amounts", async () => {
    const service = new DonationService(new MemoryStateRepository());

    await expect(
      service.addSponsor({ bossName: " ", amount: 0, programName: " ", countsTowardCharge: true, note: "" })
    ).rejects.toThrow("老板名、节目名和赞助金额都必须填写正确");
  });
});
