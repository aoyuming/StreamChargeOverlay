import { describe, expect, it } from "vitest";
import { amountRarityClass } from "../amountRarity";

describe("amountRarityClass", () => {
  it.each([
    [0, "amount-rarity-common"],
    [99, "amount-rarity-common"],
    [100, "amount-rarity-advanced"],
    [199, "amount-rarity-advanced"],
    [200, "amount-rarity-rare"],
    [299, "amount-rarity-rare"],
    [300, "amount-rarity-artifact"],
    [399, "amount-rarity-artifact"],
    [400, "amount-rarity-legendary"],
    [499, "amount-rarity-legendary"],
    [500, "amount-rarity-epic"],
    [1200, "amount-rarity-epic"]
  ])("maps %s amount to %s", (amount, className) => {
    expect(amountRarityClass(amount)).toBe(className);
  });
});
