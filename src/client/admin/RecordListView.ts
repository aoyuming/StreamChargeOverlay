import type { SponsorRecord, UpdateSponsorRequest } from "../../shared/types";
import { clearAndAppend } from "../common/dom";
import { formatTime } from "../common/format";
import { compressAvatarFile, readAvatarFromClipboard } from "./AvatarImageProcessor";

type RemoveFromTodayHandler = (id: string) => Promise<void>;
type AddToTodayHandler = (id: string) => Promise<void>;
type UpdateSponsorHandler = (id: string, request: UpdateSponsorRequest) => Promise<void>;
type DeletePermanentlyHandler = (id: string) => Promise<void>;
type RestoreSponsorHandler = (id: string) => Promise<void>;
type UpdateAvatarHandler = (id: string, avatarDataUrl: string | null) => Promise<void>;
type RecordMode = "active" | "trash";
type RecordAvatarSnapshot = {
  backgroundImage: string;
  className: string;
  textContent: string;
};

export class RecordListView {
  private removeFromTodayHandler: RemoveFromTodayHandler | null = null;
  private addToTodayHandler: AddToTodayHandler | null = null;
  private updateSponsorHandler: UpdateSponsorHandler | null = null;
  private deletePermanentlyHandler: DeletePermanentlyHandler | null = null;
  private restoreSponsorHandler: RestoreSponsorHandler | null = null;
  private updateAvatarHandler: UpdateAvatarHandler | null = null;
  private visibleTodayIds = new Set<string>();
  private canManageRecords = true;
  private canManageToday = true;

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

  public onUpdateSponsor(handler: UpdateSponsorHandler): void {
    this.updateSponsorHandler = handler;
  }

  public onDeletePermanently(handler: DeletePermanentlyHandler): void {
    this.deletePermanentlyHandler = handler;
  }

  public onRestoreSponsor(handler: RestoreSponsorHandler): void {
    this.restoreSponsorHandler = handler;
  }

  public onUpdateAvatar(handler: UpdateAvatarHandler): void {
    this.updateAvatarHandler = handler;
  }

  public setCanManage(canManage: boolean): void {
    this.setPermissions({ canManageRecords: canManage, canManageToday: canManage });
  }

  public setPermissions(permissions: { canManageRecords: boolean; canManageToday: boolean }): void {
    this.canManageRecords = permissions.canManageRecords;
    this.canManageToday = permissions.canManageToday;
    this.listElement.classList.toggle("is-readonly", !permissions.canManageRecords && !permissions.canManageToday);
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

  public renderTrash(records: SponsorRecord[]): void {
    this.visibleTodayIds = new Set();
    const fragment = document.createDocumentFragment();
    const sortedRecords = [...records].sort((left, right) => (right.deletedAt ?? 0) - (left.deletedAt ?? 0));

    for (const record of sortedRecords) {
      fragment.append(this.createRecordRow(record, false, "trash"));
    }

    if (sortedRecords.length === 0) {
      const empty = document.createElement("div");
      empty.className = "record-empty";
      empty.textContent = "回收站为空";
      fragment.append(empty);
    }

    clearAndAppend(this.listElement, fragment);
  }

  private createRecordRow(record: SponsorRecord, isVisibleToday: boolean, mode: RecordMode = "active"): HTMLElement {
    const row = document.createElement("article");
    row.className = `record-row${mode === "trash" ? " is-trash" : ""}`;
    row.dataset.id = record.id;
    row.dataset.visibleToday = String(isVisibleToday);

    const avatar = document.createElement("span");
    avatar.className = `record-avatar${record.avatarUrl ? " has-image" : " is-placeholder"}`;
    avatar.style.backgroundImage = record.avatarUrl ? `url("${record.avatarUrl}")` : "";
    avatar.textContent = record.avatarUrl ? "" : this.avatarInitial(record.bossName);

    const main = document.createElement("div");
    main.className = "record-main";

    const title = document.createElement("strong");
    title.textContent = record.programName;

    const meta = document.createElement("span");
    meta.textContent = `${record.bossName} / ${formatTime(record.createdAt)} / ￥${this.formatAmount(record.amount)}`;

    const note = document.createElement("small");
    note.textContent = record.note || "无备注";

    const flags = document.createElement("div");
    flags.className = "record-flags";
    if (mode === "trash") {
      flags.append(
        this.createFlag(record.deletedAt ? `删除时间 ${formatTime(record.deletedAt)}` : "回收站"),
        this.createFlag("7天后彻底删除")
      );
    } else {
      flags.append(
        this.createFlag(record.countsTowardCharge ? "加入启动资金" : "不加入启动资金"),
        this.createFlag(isVisibleToday ? "今日榜单显示中" : "今日榜单已移除")
      );
    }

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const editButton = document.createElement("button");
    editButton.className = "ghost-button";
    editButton.type = "button";
    editButton.dataset.action = "edit-record";
    editButton.disabled = !this.canManageRecords && !this.canManageToday;
    editButton.textContent = this.canManageRecords ? "编辑" : "今日展示";

    const quickAddTodayButton = document.createElement("button");
    quickAddTodayButton.className = "ghost-button";
    quickAddTodayButton.type = "button";
    quickAddTodayButton.dataset.action = "add-today";
    quickAddTodayButton.disabled = !this.canManageToday || isVisibleToday;
    quickAddTodayButton.textContent = isVisibleToday ? "今日展示中" : "加入今日展示";

    const restoreButton = document.createElement("button");
    restoreButton.className = "ghost-button";
    restoreButton.type = "button";
    restoreButton.dataset.action = "restore-sponsor";
    restoreButton.disabled = !this.canManageRecords;
    restoreButton.textContent = "还原";

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button danger";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete-permanent";
    deleteButton.disabled = !this.canManageRecords;
    deleteButton.textContent = mode === "trash" ? "彻底删除" : "删除";

    if (mode === "trash") {
      actions.append(restoreButton, deleteButton);
      main.append(title, meta, note, flags);
      row.append(avatar, main, actions);
      return row;
    }

    actions.append(editButton, quickAddTodayButton);
    const editForm = this.createEditForm(record, isVisibleToday);
    main.append(title, meta, note, flags);
    row.append(avatar, main, actions, editForm);
    return row;
  }

  private createEditForm(record: SponsorRecord, isVisibleToday: boolean): HTMLElement {
    const form = document.createElement("div");
    form.className = "record-edit-form";
    form.hidden = true;

    const todayLabel = this.createTodayEditControl(isVisibleToday);
    if (!this.canManageRecords) {
      const footer = document.createElement("div");
      footer.className = "record-edit-footer";
      const saveTodayButton = this.createActionButton("保存今日展示", "save-record");
      saveTodayButton.disabled = !this.canManageToday;
      const cancelButton = this.createActionButton("取消", "cancel-edit");
      footer.append(saveTodayButton, cancelButton);
      form.append(todayLabel, footer);
      return form;
    }

    const bossNameInput = this.createEditInput("record-edit-boss", "老板名", record.bossName);
    const amountInput = this.createEditInput("record-edit-amount", "金额", String(record.amount), "number");
    amountInput.min = "0.01";
    amountInput.step = "0.01";
    const programInput = this.createEditInput("record-edit-program", "节目", record.programName);
    const createdAtInput = this.createEditInput("record-edit-created", "时间", this.formatDateTimeLocal(record.createdAt), "datetime-local");

    const noteLabel = document.createElement("label");
    noteLabel.className = "record-edit-field record-edit-note-field";
    noteLabel.textContent = "备注";
    const noteInput = document.createElement("textarea");
    noteInput.className = "record-edit-note";
    noteInput.rows = 2;
    noteInput.value = record.note;
    noteInput.disabled = !this.canManageRecords;
    noteLabel.append(noteInput);

    const countsLabel = document.createElement("label");
    countsLabel.className = "record-edit-check";
    const countsInput = document.createElement("input");
    countsInput.className = "record-edit-counts-charge";
    countsInput.type = "checkbox";
    countsInput.checked = record.countsTowardCharge;
    countsInput.disabled = !this.canManageRecords;
    const countsText = document.createElement("span");
    countsText.textContent = "加入启动资金";
    countsLabel.append(countsInput, countsText);

    const avatarActions = document.createElement("div");
    avatarActions.className = "record-edit-avatar-actions";

    const updateAvatarButton = this.createActionButton("更换头像", "update-avatar");
    const pasteAvatarButton = this.createActionButton("粘贴头像 Ctrl+V", "paste-avatar");
    const clearAvatarButton = this.createActionButton("清除头像", "clear-avatar", true);
    clearAvatarButton.disabled = !record.avatarUrl;

    const avatarInput = document.createElement("input");
    avatarInput.className = "record-avatar-input";
    avatarInput.type = "file";
    avatarInput.accept = "image/*";
    avatarInput.hidden = true;
    avatarInput.disabled = !this.canManageRecords;
    avatarActions.append(updateAvatarButton, pasteAvatarButton, clearAvatarButton, avatarInput);

    const footer = document.createElement("div");
    footer.className = "record-edit-footer";
    const saveButton = this.createActionButton("保存修改", "save-record");
    const cancelButton = this.createActionButton("取消", "cancel-edit");
    const deleteButton = this.createActionButton("删除", "delete-permanent", true);
    footer.append(saveButton, cancelButton, deleteButton);

    form.append(
      bossNameInput.closest("label") as HTMLLabelElement,
      amountInput.closest("label") as HTMLLabelElement,
      programInput.closest("label") as HTMLLabelElement,
      createdAtInput.closest("label") as HTMLLabelElement,
      noteLabel,
      countsLabel,
      todayLabel,
      avatarActions,
      footer
    );
    return form;
  }

  private createTodayEditControl(isVisibleToday: boolean): HTMLElement {
    const todayLabel = document.createElement("label");
    todayLabel.className = "record-edit-check record-edit-today-check";
    const todayInput = document.createElement("input");
    todayInput.className = "record-edit-today";
    todayInput.type = "checkbox";
    todayInput.checked = isVisibleToday;
    todayInput.disabled = !this.canManageToday;
    const todayText = document.createElement("span");
    todayText.textContent = "今日榜单显示中";
    todayLabel.append(todayInput, todayText);
    return todayLabel;
  }

  private createActionButton(text: string, action: string, danger = false): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = `ghost-button${danger ? " danger" : ""}`;
    button.type = "button";
    button.dataset.action = action;
    button.disabled = action !== "cancel-edit" && !this.canManageRecords;
    button.textContent = text;
    return button;
  }

  private createEditInput(className: string, labelText: string, value: string, type = "text"): HTMLInputElement {
    const label = document.createElement("label");
    label.className = "record-edit-field";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.className = className;
    input.type = type;
    input.value = value;
    input.disabled = !this.canManageRecords;
    label.append(input);
    return input;
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

    if (target.dataset.action === "edit-record") {
      row.classList.add("is-editing");
      const form = row.querySelector<HTMLElement>(".record-edit-form");
      if (form) {
        form.hidden = false;
      }
      return;
    }

    if (target.dataset.action === "cancel-edit") {
      row.classList.remove("is-editing");
      const form = row.querySelector<HTMLElement>(".record-edit-form");
      if (form) {
        form.hidden = true;
      }
      return;
    }

    if (target.dataset.action === "save-record") {
      const wasVisibleToday = row.dataset.visibleToday === "true";
      const nextVisibleToday = this.todayVisibilityFromRow(row);
      if (this.canManageRecords && this.updateSponsorHandler) {
        await this.updateSponsorHandler(id, this.recordUpdateFromRow(row));
      }
      await this.syncTodayVisibility(id, wasVisibleToday, nextVisibleToday);
      row.classList.remove("is-editing");
      const form = row.querySelector<HTMLElement>(".record-edit-form");
      if (form) {
        form.hidden = true;
      }
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

    if (target.dataset.action === "restore-sponsor" && this.restoreSponsorHandler) {
      await this.restoreSponsorHandler(id);
      return;
    }

    if (target.dataset.action === "update-avatar") {
      row.querySelector<HTMLInputElement>(".record-avatar-input")?.click();
      return;
    }

    if (target.dataset.action === "paste-avatar" && this.updateAvatarHandler) {
      let previousAvatar: RecordAvatarSnapshot | null = null;
      try {
        const avatarDataUrl = await readAvatarFromClipboard();
        previousAvatar = this.previewRecordAvatar(row, avatarDataUrl);
        if (!window.confirm("确认用剪切板中的图片更换这条赞助记录的头像吗？")) {
          this.restoreRecordAvatar(row, previousAvatar);
          return;
        }

        await this.updateAvatarHandler(id, avatarDataUrl);
      } catch (error) {
        this.restoreRecordAvatar(row, previousAvatar);
        window.alert(error instanceof Error ? error.message : "头像处理失败");
      }
      return;
    }

    if (target.dataset.action === "clear-avatar" && this.updateAvatarHandler) {
      await this.updateAvatarHandler(id, null);
      return;
    }

  }

  private todayVisibilityFromRow(row: HTMLElement): boolean {
    return row.querySelector<HTMLInputElement>(".record-edit-today")?.checked ?? row.dataset.visibleToday === "true";
  }

  private async syncTodayVisibility(id: string, wasVisibleToday: boolean, nextVisibleToday: boolean): Promise<void> {
    if (!this.canManageToday || wasVisibleToday === nextVisibleToday) {
      return;
    }

    if (nextVisibleToday && this.addToTodayHandler) {
      await this.addToTodayHandler(id);
      return;
    }

    if (!nextVisibleToday && this.removeFromTodayHandler) {
      await this.removeFromTodayHandler(id);
    }
  }

  private recordUpdateFromRow(row: HTMLElement): UpdateSponsorRequest {
    const bossNameInput = this.requiredField<HTMLInputElement>(row, ".record-edit-boss");
    const amountInput = this.requiredField<HTMLInputElement>(row, ".record-edit-amount");
    const programInput = this.requiredField<HTMLInputElement>(row, ".record-edit-program");
    const noteInput = this.requiredField<HTMLTextAreaElement>(row, ".record-edit-note");
    const createdAtInput = this.requiredField<HTMLInputElement>(row, ".record-edit-created");
    const countsTowardChargeInput = this.requiredField<HTMLInputElement>(row, ".record-edit-counts-charge");

    return {
      bossName: bossNameInput.value,
      amount: Number(amountInput.value),
      programName: programInput.value,
      note: noteInput.value,
      countsTowardCharge: countsTowardChargeInput.checked,
      createdAt: new Date(createdAtInput.value).getTime()
    };
  }

  private requiredField<T extends HTMLElement>(row: HTMLElement, selector: string): T {
    const element = row.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing record edit field: ${selector}`);
    }
    return element;
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

  private formatAmount(amount: number): string {
    return amount.toFixed(2).replace(/\.?0+$/, "");
  }

  private formatDateTimeLocal(timestamp: number): string {
    const date = new Date(timestamp);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private previewRecordAvatar(row: HTMLElement, avatarDataUrl: string): RecordAvatarSnapshot | null {
    const avatar = row.querySelector<HTMLElement>(".record-avatar");
    if (!avatar) {
      return null;
    }

    const snapshot = {
      backgroundImage: avatar.style.backgroundImage,
      className: avatar.className,
      textContent: avatar.textContent ?? ""
    };
    avatar.className = "record-avatar has-image";
    avatar.style.backgroundImage = `url("${avatarDataUrl}")`;
    avatar.textContent = "";
    return snapshot;
  }

  private restoreRecordAvatar(row: HTMLElement, snapshot: RecordAvatarSnapshot | null): void {
    const avatar = row.querySelector<HTMLElement>(".record-avatar");
    if (!avatar || !snapshot) {
      return;
    }

    avatar.className = snapshot.className;
    avatar.style.backgroundImage = snapshot.backgroundImage;
    avatar.textContent = snapshot.textContent;
  }
}
