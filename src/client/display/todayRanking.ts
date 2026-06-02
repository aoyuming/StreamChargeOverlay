import type { SponsorRankingItem, SponsorRecord } from "../../shared/types";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const buildTodayRanking = (records: SponsorRecord[], now = Date.now()): SponsorRankingItem[] => {
  const cutoff = now - RECENT_WINDOW_MS;
  const rankingMap = new Map<string, SponsorRankingItem>();

  for (const record of records) {
    if (record.createdAt < cutoff) {
      continue;
    }

    const current = rankingMap.get(record.bossName);
    if (current) {
      current.totalAmount = Math.round((current.totalAmount + record.amount) * 100) / 100;
      current.recordCount += 1;
      current.latestAt = Math.max(current.latestAt, record.createdAt);
      continue;
    }

    rankingMap.set(record.bossName, {
      bossName: record.bossName,
      totalAmount: record.amount,
      recordCount: 1,
      latestAt: record.createdAt
    });
  }

  return [...rankingMap.values()].sort((left, right) => {
    if (right.totalAmount !== left.totalAmount) {
      return right.totalAmount - left.totalAmount;
    }
    return right.latestAt - left.latestAt;
  });
};
