import type { SponsorRankingItem } from "../../shared/types";
import { clearAndAppend } from "../common/dom";
import { formatAmount } from "../common/format";

export class RankingTicker {
  public constructor(
    private readonly pinnedElement: HTMLElement,
    private readonly listElement: HTMLElement
  ) {}

  public render(items: SponsorRankingItem[]): void {
    const pinnedItems = items.slice(0, 2);
    const rollingItems = items.slice(2);
    this.renderPinned(pinnedItems);
    this.renderRolling(rollingItems);
  }

  private renderPinned(items: SponsorRankingItem[]): void {
    const fragment = document.createDocumentFragment();

    if (items.length === 0) {
      fragment.append(this.createEmptyRow("等待老板登榜"));
      clearAndAppend(this.pinnedElement, fragment);
      return;
    }

    items.forEach((item, index) => fragment.append(this.createRow(item, index + 1, true)));
    clearAndAppend(this.pinnedElement, fragment);
  }

  private renderRolling(items: SponsorRankingItem[]): void {
    const fragment = document.createDocumentFragment();
    const visibleItems = items.length > 0 ? items : [];
    const loopItems = visibleItems.length > 3 ? [...visibleItems, ...visibleItems] : visibleItems;
    this.listElement.classList.toggle("is-scrolling", visibleItems.length > 3);

    if (loopItems.length === 0) {
      fragment.append(this.createEmptyRow("后续名次待命"));
      clearAndAppend(this.listElement, fragment);
      return;
    }

    loopItems.forEach((item, index) => {
      fragment.append(this.createRow(item, (index % visibleItems.length) + 3, false));
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
    name.textContent = item.bossName;

    const amount = document.createElement("span");
    amount.className = "rank-amount";
    amount.textContent = formatAmount(item.totalAmount);

    row.append(badge, name, amount);
    return row;
  }

  private createEmptyRow(text: string): HTMLElement {
    const row = document.createElement("li");
    row.className = "rank-row is-empty";
    row.textContent = text;
    return row;
  }
}
