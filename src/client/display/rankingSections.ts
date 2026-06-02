export const splitPinnedRankingItems = <T>(items: T[]) => {
  return {
    pinnedItems: items.slice(0, 2),
    rollingItems: items.slice(2)
  };
};
