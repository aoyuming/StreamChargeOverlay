import type { SponsorRecord } from "../../shared/types";
import { formatRootUnits, neutralizePublicText } from "../../shared/displayUnits";
import { clearAndAppend } from "../common/dom";
import { formatTime } from "../common/format";

type RemoveFromTodayHandler = (id: string) => Promise<void>;

export class TodayDisplayListView {
  private removeFromTodayHandler: RemoveFromTodayHandler | null = null;
  private canOperate = true;

  public constructor(private readonly listElement: HTMLElement) {
    this.listElement.addEventListener("click", (event) => void this.handleClick(event));
  }

  public onRemoveFromToday(handler: RemoveFromTodayHandler): void {
    this.removeFromTodayHandler = handler;
  }

  public setCanOperate(canOperate: boolean): void {
    this.canOperate = canOperate;
    this.listElement.classList.toggle("is-readonly", !canOperate);
  }

  public render(records: SponsorRecord[]): void {
    const fragment = document.createDocumentFragment();

    for (const record of records) {
      fragment.append(this.createRow(record));
    }

    if (records.length === 0) {
      const empty = document.createElement("div");
      empty.className = "record-empty";
      empty.textContent = "等待大哥登榜";
      fragment.append(empty);
    }

    clearAndAppend(this.listElement, fragment);
  }

  private createRow(record: SponsorRecord): HTMLElement {
    const row = document.createElement("article");
    row.className = "today-display-row";
    row.dataset.id = record.id;

    const main = document.createElement("div");
    main.className = "today-display-main";

    const title = document.createElement("strong");
    title.textContent = neutralizePublicText(record.programName);

    const meta = document.createElement("span");
    meta.textContent = `${record.bossName} / ${formatRootUnits(record.amount)} / ${formatTime(record.createdAt)}`;

    const note = document.createElement("small");
    note.textContent = neutralizePublicText(record.note) || "无备注";

    const removeButton = document.createElement("button");
    removeButton.className = "ghost-button danger";
    removeButton.type = "button";
    removeButton.dataset.action = "remove-today";
    removeButton.disabled = !this.canOperate;
    removeButton.textContent = "移除今日展示";

    main.append(title, meta, note);
    row.append(main, removeButton);
    return row;
  }

  private async handleClick(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || target.dataset.action !== "remove-today") {
      return;
    }

    const id = target.closest<HTMLElement>(".today-display-row")?.dataset.id;
    if (id && this.removeFromTodayHandler) {
      await this.removeFromTodayHandler(id);
    }
  }
}
