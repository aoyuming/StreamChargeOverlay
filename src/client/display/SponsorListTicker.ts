import type { SponsorRecord } from "../../shared/types";
import { formatDisplayName, formatRootUnits, neutralizePublicText } from "../../shared/displayUnits";
import { clearAndAppend } from "../common/dom";

export class SponsorListTicker {
  public constructor(private readonly listElement: HTMLElement) {}

  public render(records: SponsorRecord[]): void {
    const sortedRecords = [...records].sort((left, right) => right.createdAt - left.createdAt);
    const loopRecords = sortedRecords.length > 3 ? [...sortedRecords, ...sortedRecords] : sortedRecords;
    const fragment = document.createDocumentFragment();
    this.listElement.classList.toggle("is-scrolling", sortedRecords.length > 3);

    if (loopRecords.length === 0) {
      fragment.append(this.createEmptyCard());
      clearAndAppend(this.listElement, fragment);
      return;
    }

    loopRecords.forEach((record) => fragment.append(this.createCard(record)));
    clearAndAppend(this.listElement, fragment);
  }

  private createCard(record: SponsorRecord): HTMLElement {
    const card = document.createElement("li");
    card.className = "sponsor-card";

    const bossName = document.createElement("strong");
    bossName.className = "sponsor-name";
    bossName.textContent = formatDisplayName(record.bossName);

    const amount = document.createElement("span");
    amount.className = "sponsor-amount";
    amount.textContent = formatRootUnits(record.amount);

    const note = document.createElement("span");
    note.className = "sponsor-note";
    note.textContent = neutralizePublicText(record.note || record.programName || "等待备注");

    const tag = document.createElement("span");
    tag.className = "sponsor-tag";
    tag.textContent = neutralizePublicText(record.programName);

    card.append(bossName, amount, note, tag);
    return card;
  }

  private createEmptyCard(): HTMLElement {
    const card = document.createElement("li");
    card.className = "sponsor-card is-empty";
    card.textContent = "等待大哥入场";
    return card;
  }
}
