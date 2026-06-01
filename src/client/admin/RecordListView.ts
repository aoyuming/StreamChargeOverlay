import type { SponsorRecord } from "../../shared/types";
import { clearAndAppend } from "../common/dom";
import { formatAmount, formatTime } from "../common/format";

type DeleteHandler = (id: string) => Promise<void>;

export class RecordListView {
  private deleteHandler: DeleteHandler | null = null;

  public constructor(private readonly listElement: HTMLElement) {
    this.listElement.addEventListener("click", (event) => void this.handleClick(event));
  }

  public onDelete(handler: DeleteHandler): void {
    this.deleteHandler = handler;
  }

  public render(records: SponsorRecord[]): void {
    const fragment = document.createDocumentFragment();
    const sortedRecords = [...records].sort((left, right) => right.createdAt - left.createdAt);

    for (const record of sortedRecords) {
      fragment.append(this.createRecordRow(record));
    }

    if (sortedRecords.length === 0) {
      const empty = document.createElement("div");
      empty.className = "record-empty";
      empty.textContent = "还没有赞助记录";
      fragment.append(empty);
    }

    clearAndAppend(this.listElement, fragment);
  }

  private createRecordRow(record: SponsorRecord): HTMLElement {
    const row = document.createElement("article");
    row.className = "record-row";

    const main = document.createElement("div");
    main.className = "record-main";

    const title = document.createElement("strong");
    title.textContent = record.programName;

    const meta = document.createElement("span");
    meta.textContent = `${record.bossName} / ${formatAmount(record.amount)} / ${formatTime(record.createdAt)}`;

    const note = document.createElement("small");
    note.textContent = record.note || "无备注";

    const button = document.createElement("button");
    button.className = "ghost-button danger";
    button.type = "button";
    button.dataset.id = record.id;
    button.textContent = "删除";

    main.append(title, meta, note);
    row.append(main, button);
    return row;
  }

  private async handleClick(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.id || !this.deleteHandler) {
      return;
    }

    await this.deleteHandler(target.dataset.id);
  }
}
