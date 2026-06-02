import { describe, expect, it } from "vitest";
import { splitPinnedRankingItems } from "../rankingSections";

describe("splitPinnedRankingItems", () => {
  it("keeps the first two items pinned and leaves later items rolling", () => {
    const items = ["one", "two", "three", "four"];

    expect(splitPinnedRankingItems(items)).toEqual({
      pinnedItems: ["one", "two"],
      rollingItems: ["three", "four"]
    });
  });

  it("keeps short lists fully pinned", () => {
    expect(splitPinnedRankingItems(["one"])).toEqual({
      pinnedItems: ["one"],
      rollingItems: []
    });
  });
});
