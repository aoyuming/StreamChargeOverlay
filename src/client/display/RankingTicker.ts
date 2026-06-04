import type { SponsorRankingItem } from "../../shared/types";
import { formatDisplayName, formatRootUnits } from "../../shared/displayUnits";
import { clearAndAppend } from "../common/dom";
import { splitPinnedRankingItems } from "./rankingSections";

export class RankingTicker {
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
      fragment.append(this.createEmptyRow("等待大哥登榜"));
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
    name.textContent = formatDisplayName(item.bossName);

    const avatar = document.createElement("span");
    avatar.className = `rank-avatar${item.avatarUrl ? " has-image" : " is-placeholder"}`;
    avatar.style.backgroundImage = item.avatarUrl ? `url("${item.avatarUrl}")` : "";
    avatar.textContent = item.avatarUrl ? "" : this.avatarInitial(item.bossName);

    const amount = document.createElement("span");
    amount.className = "rank-amount";
    amount.textContent = formatRootUnits(item.totalAmount);

    row.append(badge, avatar, name, amount);
    return row;
  }

  private createEmptyRow(text: string): HTMLElement {
    const row = document.createElement("li");
    row.className = "rank-row is-empty";
    row.textContent = text;
    return row;
  }

  private avatarInitial(name: string): string {
    return formatDisplayName(name).charAt(0).toUpperCase() || "B";
  }
}
