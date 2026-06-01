import type { SponsorRecord } from "../../shared/types";
import { clearAndAppend } from "../common/dom";
import { formatAmount } from "../common/format";

export class ProgramTicker {
  public constructor(private readonly listElement: HTMLElement) {}

  public render(records: SponsorRecord[]): void {
    const fragment = document.createDocumentFragment();
    const loopRecords = records.length > 3 ? [...records, ...records] : records;
    this.listElement.classList.toggle("is-scrolling", records.length > 3);

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
    card.className = "program-card";

    const title = document.createElement("strong");
    title.className = "program-title";
    title.textContent = record.programName;

    const meta = document.createElement("span");
    meta.className = "program-meta";
    meta.textContent = `${record.bossName} / ${formatAmount(record.amount)}`;

    const note = document.createElement("span");
    note.className = "program-note";
    note.textContent = record.note || "等待上场";

    card.append(title, meta, note);
    return card;
  }

  private createEmptyCard(): HTMLElement {
    const card = document.createElement("li");
    card.className = "program-card is-empty";
    card.textContent = "节目池待命";
    return card;
  }
}
