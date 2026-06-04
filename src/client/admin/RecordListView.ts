import type { SponsorRecord } from "../../shared/types";
import { clearAndAppend } from "../common/dom";
import { formatTime } from "../common/format";
import { compressAvatarFile, readAvatarFromClipboard } from "./AvatarImageProcessor";

type RemoveFromTodayHandler = (id: string) => Promise<void>;
type AddToTodayHandler = (id: string) => Promise<void>;
type UpdateAmountHandler = (id: string, amount: number) => Promise<void>;
type DeletePermanentlyHandler = (id: string) => Promise<void>;
type UpdateAvatarHandler = (id: string, avatarDataUrl: string | null) => Promise<void>;

export class RecordListView {
  private removeFromTodayHandler: RemoveFromTodayHandler | null = null;
  private addToTodayHandler: AddToTodayHandler | null = null;
  private updateAmountHandler: UpdateAmountHandler | null = null;
  private deletePermanentlyHandler: DeletePermanentlyHandler | null = null;
  private updateAvatarHandler: UpdateAvatarHandler | null = null;
  private visibleTodayIds = new Set<string>();
  private canManage = true;

  public constructor(private readonly listElement: HTMLElement) {
    this.listElement.addEventListener("click", (event) => void this.handleClick(event));
    this.listElement.addEventListener("change", (event) => void this.handleChange(event));
  }

  public onRemoveFromToday(handler: RemoveFromTodayHandler): void {
    this.removeFromTodayHandler = handler;
  }

  public onAddToToday(handler: AddToTodayHandler): void {
    this.addToTodayHandler = handler;
  }

  public onUpdateAmount(handler: UpdateAmountHandler): void {
    this.updateAmountHandler = handler;
  }

  public onDeletePermanently(handler: DeletePermanentlyHandler): void {
    this.deletePermanentlyHandler = handler;
  }

  public onUpdateAvatar(handler: UpdateAvatarHandler): void {
    this.updateAvatarHandler = handler;
  }

  public setCanManage(canManage: boolean): void {
    this.canManage = canManage;
    this.listElement.classList.toggle("is-readonly", !canManage);
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

    const avatar = document.createElement("span");
    avatar.className = `record-avatar${record.avatarUrl ? " has-image" : " is-placeholder"}`;
    avatar.style.backgroundImage = record.avatarUrl ? `url("${record.avatarUrl}")` : "";
    avatar.textContent = record.avatarUrl ? "" : this.avatarInitial(record.bossName);

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
    amountInput.disabled = !this.canManage;
    amountInput.setAttribute("aria-label", `${record.bossName} 赞助金额`);

    const saveButton = document.createElement("button");
    saveButton.className = "ghost-button";
    saveButton.type = "button";
    saveButton.dataset.action = "save-amount";
    saveButton.disabled = !this.canManage;
    saveButton.textContent = "保存金额";

    const removeButton = document.createElement("button");
    removeButton.className = "ghost-button danger";
    removeButton.type = "button";
    removeButton.dataset.action = "remove-today";
    removeButton.disabled = !this.canManage || !isVisibleToday;
    removeButton.textContent = isVisibleToday ? "移除今日榜单" : "已移除";

    const addButton = document.createElement("button");
    addButton.className = "ghost-button";
    addButton.type = "button";
    addButton.dataset.action = "add-today";
    addButton.disabled = !this.canManage || isVisibleToday;
    addButton.textContent = "加入今日榜单";

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button danger";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete-permanent";
    deleteButton.disabled = !this.canManage;
    deleteButton.textContent = "永久删除";

    const updateAvatarButton = document.createElement("button");
    updateAvatarButton.className = "ghost-button";
    updateAvatarButton.type = "button";
    updateAvatarButton.dataset.action = "update-avatar";
    updateAvatarButton.disabled = !this.canManage;
    updateAvatarButton.textContent = "更换头像";

    const pasteAvatarButton = document.createElement("button");
    pasteAvatarButton.className = "ghost-button";
    pasteAvatarButton.type = "button";
    pasteAvatarButton.dataset.action = "paste-avatar";
    pasteAvatarButton.disabled = !this.canManage;
    pasteAvatarButton.textContent = "剪切板导入头像";

    const clearAvatarButton = document.createElement("button");
    clearAvatarButton.className = "ghost-button danger";
    clearAvatarButton.type = "button";
    clearAvatarButton.dataset.action = "clear-avatar";
    clearAvatarButton.disabled = !this.canManage || !record.avatarUrl;
    clearAvatarButton.textContent = "清除头像";

    const avatarInput = document.createElement("input");
    avatarInput.className = "record-avatar-input";
    avatarInput.type = "file";
    avatarInput.accept = "image/*";
    avatarInput.hidden = true;
    avatarInput.disabled = !this.canManage;

    actions.append(
      amountInput,
      saveButton,
      removeButton,
      addButton,
      updateAvatarButton,
      pasteAvatarButton,
      clearAvatarButton,
      deleteButton,
      avatarInput
    );
    main.append(title, meta, note, flags);
    row.append(avatar, main, actions);
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

    if (target.dataset.action === "add-today" && this.addToTodayHandler) {
      await this.addToTodayHandler(id);
      return;
    }

    if (target.dataset.action === "delete-permanent" && this.deletePermanentlyHandler) {
      await this.deletePermanentlyHandler(id);
      return;
    }

    if (target.dataset.action === "update-avatar") {
      row.querySelector<HTMLInputElement>(".record-avatar-input")?.click();
      return;
    }

    if (target.dataset.action === "paste-avatar" && this.updateAvatarHandler) {
      try {
        const avatarDataUrl = await readAvatarFromClipboard();
        if (!window.confirm("确认用剪切板中的图片更换这条赞助记录的头像吗？")) {
          return;
        }

        await this.updateAvatarHandler(id, avatarDataUrl);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "头像处理失败");
      }
      return;
    }

    if (target.dataset.action === "clear-avatar" && this.updateAvatarHandler) {
      await this.updateAvatarHandler(id, null);
      return;
    }

    if (target.dataset.action === "save-amount" && this.updateAmountHandler) {
      const input = row.querySelector<HTMLInputElement>(".record-amount-input");
      const amount = Number(input?.value ?? 0);
      await this.updateAmountHandler(id, amount);
    }
  }

  private async handleChange(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("record-avatar-input")) {
      return;
    }

    const row = target.closest<HTMLElement>(".record-row");
    const id = row?.dataset.id;
    const file = target.files?.[0];
    if (!id || !file || !this.updateAvatarHandler) {
      return;
    }

    try {
      await this.updateAvatarHandler(id, await compressAvatarFile(file));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "头像处理失败");
    } finally {
      target.value = "";
    }
  }

  private avatarInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "B";
  }
}
