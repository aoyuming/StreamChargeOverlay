import { describe, expect, it } from "vitest";
import type { SponsorRecord } from "../../../shared/types";
import { buildTodayRanking } from "../todayRanking";

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const record = (overrides: Partial<SponsorRecord>): SponsorRecord => ({
  id: "seed",
  bossName: "默认大哥",
  amount: 100,
  programName: "点将",
  note: "",
  createdAt: NOW,
  ...overrides
});

describe("buildTodayRanking", () => {
  it("returns an empty list when there are no recent records", () => {
    expect(buildTodayRanking([], NOW)).toEqual([]);
    expect(buildTodayRanking([record({ createdAt: NOW - DAY_MS - 1 })], NOW)).toEqual([]);
  });

  it("keeps records from the most recent 24 hours including the boundary", () => {
    const ranking = buildTodayRanking(
      [
        record({ bossName: "边界大哥", amount: 100, createdAt: NOW - DAY_MS }),
        record({ bossName: "过期大哥", amount: 500, createdAt: NOW - DAY_MS - 1 }),
        record({ bossName: "当前大哥", amount: 300, createdAt: NOW - 1_000 })
      ],
      NOW
    );

    expect(ranking.map((item) => [item.bossName, item.totalAmount])).toEqual([
      ["当前大哥", 300],
      ["边界大哥", 100]
    ]);
  });

  it("aggregates by name and breaks ties by latest record time", () => {
    const ranking = buildTodayRanking(
      [
        record({ bossName: "累计大哥", amount: 100, createdAt: NOW - 5_000 }),
        record({ bossName: "并列较早", amount: 300, createdAt: NOW - 4_000 }),
        record({ bossName: "累计大哥", amount: 200, createdAt: NOW - 3_000 }),
        record({ bossName: "并列较新", amount: 300, createdAt: NOW - 2_000 })
      ],
      NOW
    );

    expect(ranking.map((item) => [item.bossName, item.totalAmount, item.recordCount])).toEqual([
      ["并列较新", 300, 1],
      ["累计大哥", 300, 2],
      ["并列较早", 300, 1]
    ]);
  });
});
