import type { SponsorRankingItem } from "../../shared/types";
import { formatDisplayName, formatRootUnits } from "../../shared/displayUnits";
import { clearAndAppend } from "../common/dom";
import { splitPinnedRankingItems } from "./rankingSections";

export class TodayRankingTicker {
  public constructor(
    private readonly pinnedElement: HTMLElement,
    private readonly listElement: HTMLElement
  ) {}

  public render(items: SponsorRankingItem[]): void {
    const { pinnedItems, rollingItems } = splitPinnedRankingItems(items);
    this.renderPinned(pinnedItems);
    this.renderRolling(rollingItems);
  }

  private renderPinned(items: SponsorRankingItem[]): void {
    const fragment = document.createDocumentFragment();

    if (items.length === 0) {
      fragment.append(this.createEmptyRow());
      clearAndAppend(this.pinnedElement, fragment);
      return;
    }

    items.forEach((item, index) => fragment.append(this.createRow(item, index + 1, true)));
    clearAndAppend(this.pinnedElement, fragment);
  }

  private renderRolling(items: SponsorRankingItem[]): void {
    const fragment = document.createDocumentFragment();
    const loopItems = items.length > 3 ? [...items, ...items] : items;
    this.listElement.classList.toggle("is-scrolling", items.length > 3);

    if (loopItems.length === 0) {
      fragment.append(this.createWaitingRow());
      clearAndAppend(this.listElement, fragment);
      return;
    }

    loopItems.forEach((item, index) => {
      fragment.append(this.createRow(item, (index % items.length) + 3, false));
    });
    clearAndAppend(this.listElement, fragment);
  }

  private createRow(item: SponsorRankingItem, rank: number, pinned: boolean): HTMLElement {
    const row = document.createElement("li");
    row.className = pinned ? `rank-row is-pinned rank-${rank}` : "rank-row";

    const badge = document.createElement("span");
    badge.className = "rank-badge";
    badge.textContent = `${rank}`;

    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = formatDisplayName(item.bossName);

    const amount = document.createElement("span");
    amount.className = "rank-amount";
    amount.textContent = formatRootUnits(item.totalAmount);

    row.append(badge, name, amount);
    return row;
  }

  private createEmptyRow(): HTMLElement {
    const row = document.createElement("li");
    row.className = "rank-row is-empty";
    row.textContent = "近24小时待命";
    return row;
  }

  private createWaitingRow(): HTMLElement {
    const row = document.createElement("li");
    row.className = "rank-row is-empty";
    row.textContent = "后续名次待命";
    return row;
  }
}
