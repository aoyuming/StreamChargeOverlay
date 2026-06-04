import type { SponsorRecord } from "../../shared/types";
import { clearAndAppend } from "../common/dom";
import { formatTime } from "../common/format";

type RemoveFromTodayHandler = (id: string) => Promise<void>;
type UpdateAmountHandler = (id: string, amount: number) => Promise<void>;

export class RecordListView {
  private removeFromTodayHandler: RemoveFromTodayHandler | null = null;
  private updateAmountHandler: UpdateAmountHandler | null = null;
  private visibleTodayIds = new Set<string>();

  public constructor(private readonly listElement: HTMLElement) {
    this.listElement.addEventListener("click", (event) => void this.handleClick(event));
  }

  public onRemoveFromToday(handler: RemoveFromTodayHandler): void {
    this.removeFromTodayHandler = handler;
  }

  public onUpdateAmount(handler: UpdateAmountHandler): void {
    this.updateAmountHandler = handler;
  }

  public render(records: SponsorRecord[], visibleTodayRecords: SponsorRecord[] = records): void {
    this.visibleTodayIds = new Set(visibleTodayRecords.map((record) => record.id));
    const fragment = document.createDocumentFragment();
    const sortedRecords = [...records].sort((left, right) => right.createdAt - left.createdAt);

    for (const record of sortedRecords) {
      fragment.append(this.createRecordRow(record, this.visibleTodayIds.has(record.id)));
    }

    if (sortedRecords.length === 0) {
      const empty = document.createElement("div");
      empty.className = "record-empty";
      empty.textContent = "还没有赞助记录";
      fragment.append(empty);
    }

    clearAndAppend(this.listElement, fragment);
  }

  private createRecordRow(record: SponsorRecord, isVisibleToday: boolean): HTMLElement {
    const row = document.createElement("article");
    row.className = "record-row";
    row.dataset.id = record.id;

    const main = document.createElement("div");
    main.className = "record-main";

    const title = document.createElement("strong");
    title.textContent = record.programName;

    const meta = document.createElement("span");
    meta.textContent = `${record.bossName} / ${formatTime(record.createdAt)}`;

    const note = document.createElement("small");
    note.textContent = record.note || "无备注";

    const flags = document.createElement("div");
    flags.className = "record-flags";
    flags.append(
      this.createFlag(record.countsTowardCharge ? "加入启动资金" : "不加入启动资金"),
      this.createFlag(isVisibleToday ? "今日榜单显示中" : "今日榜单已移除")
    );

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const amountInput = document.createElement("input");
    amountInput.className = "record-amount-input";
    amountInput.type = "number";
    amountInput.min = "0.01";
    amountInput.step = "0.01";
    amountInput.value = String(record.amount);
    amountInput.setAttribute("aria-label", `${record.bossName} 赞助金额`);

    const saveButton = document.createElement("button");
    saveButton.className = "ghost-button";
    saveButton.type = "button";
    saveButton.dataset.action = "save-amount";
    saveButton.textContent = "保存金额";

    const removeButton = document.createElement("button");
    removeButton.className = "ghost-button danger";
    removeButton.type = "button";
    removeButton.dataset.action = "remove-today";
    removeButton.disabled = !isVisibleToday;
    removeButton.textContent = isVisibleToday ? "移除今日榜单" : "已移除";

    actions.append(amountInput, saveButton, removeButton);
    main.append(title, meta, note, flags);
    row.append(main, actions);
    return row;
  }

  private createFlag(text: string): HTMLElement {
    const flag = document.createElement("span");
    flag.className = "record-flag";
    flag.textContent = text;
    return flag;
  }

  private async handleClick(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const row = target.closest<HTMLElement>(".record-row");
    const id = row?.dataset.id;
    if (!row || !id) {
      return;
    }

    if (target.dataset.action === "remove-today" && this.removeFromTodayHandler) {
      await this.removeFromTodayHandler(id);
      return;
    }

    if (target.dataset.action === "save-amount" && this.updateAmountHandler) {
      const input = row.querySelector<HTMLInputElement>(".record-amount-input");
      const amount = Number(input?.value ?? 0);
      await this.updateAmountHandler(id, amount);
    }
  }
}
