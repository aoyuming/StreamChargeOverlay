export type AmountRarity = "common" | "advanced" | "rare" | "artifact" | "legendary" | "epic";

const AMOUNT_PER_RARITY_LEVEL = 100;
const RARITY_CLASSES: AmountRarity[] = ["common", "advanced", "rare", "artifact", "legendary", "epic"];

export const amountRarityClass = (amount: number): string => {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const level = Math.min(RARITY_CLASSES.length - 1, Math.trunc(safeAmount / AMOUNT_PER_RARITY_LEVEL));
  return `amount-rarity-${RARITY_CLASSES[level]}`;
};
