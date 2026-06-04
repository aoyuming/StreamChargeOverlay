import type { AddSponsorRequest, SponsorRecord } from "../../shared/types";
import { STARTUP_FUNDING_PROGRAM_NAME } from "../../shared/displayUnits";
import { compressAvatarFile, readAvatarFromClipboard } from "./AvatarImageProcessor";

type SubmitHandler = (request: AddSponsorRequest) => Promise<void>;
type AvatarSource = "empty" | "manual" | "matched";

export class SponsorFormController {
  private submitHandler: SubmitHandler | null = null;
  private readonly bossNameInput: HTMLInputElement;
  private readonly programNameInput: HTMLInputElement;
  private readonly countsTowardChargeInput: HTMLInputElement;
  private readonly avatarPreview: HTMLElement;
  private readonly avatarFileInput: HTMLInputElement;
  private readonly chooseAvatarButton: HTMLButtonElement;
  private readonly pasteAvatarButton: HTMLButtonElement;
  private readonly clearAvatarButton: HTMLButtonElement;
  private knownSponsors: SponsorRecord[] = [];
  private editableProgramName = "";
  private avatarDataUrl: string | undefined;
  private avatarSource: AvatarSource = "empty";
  private formEnabled = true;
  private matchRequestId = 0;
  private matchedAvatarUrl: string | undefined;

  public constructor(
    private readonly form: HTMLFormElement,
    private readonly errorElement: HTMLElement
  ) {
    this.bossNameInput = this.requiredInput("bossName");
    this.programNameInput = this.requiredInput("programName");
    this.countsTowardChargeInput = this.requiredInput("countsTowardCharge");
    this.avatarPreview = this.requiredElement("#avatarPreview", HTMLElement);
    this.avatarFileInput = this.requiredElement("#avatarFileInput", HTMLInputElement);
    this.chooseAvatarButton = this.requiredElement("#chooseAvatarButton", HTMLButtonElement);
    this.pasteAvatarButton = this.requiredElement("#pasteAvatarButton", HTMLButtonElement);
    this.clearAvatarButton = this.requiredElement("#clearAvatarButton", HTMLButtonElement);
    this.form.addEventListener("submit", (event) => void this.handleSubmit(event));
    this.form.addEventListener("paste", (event) => void this.handlePaste(event));
    this.bossNameInput.addEventListener("input", () => void this.matchExistingSponsorAvatar());
    this.countsTowardChargeInput.addEventListener("change", () => this.syncStartupProgramLock());
    this.avatarFileInput.addEventListener("change", () => void this.setAvatarFromSelectedFile());
    this.chooseAvatarButton.addEventListener("click", () => this.avatarFileInput.click());
    this.pasteAvatarButton.addEventListener("click", () => void this.setAvatarFromClipboard());
    this.clearAvatarButton.addEventListener("click", () => this.clearAvatar());
    this.syncStartupProgramLock();
    this.renderAvatarPreview();
  }

  public onSubmit(handler: SubmitHandler): void {
    this.submitHandler = handler;
  }

  public showError(message: string): void {
    this.errorElement.textContent = message;
  }

  public setEnabled(enabled: boolean): void {
    this.formEnabled = enabled;
    this.form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>(
      "input, textarea, button"
    ).forEach((element) => {
      element.disabled = !enabled;
    });

    if (enabled) {
      this.syncStartupProgramLock();
    }
    this.renderAvatarPreview();
  }

  public setKnownSponsors(sponsors: SponsorRecord[]): void {
    this.knownSponsors = sponsors;
    void this.matchExistingSponsorAvatar();
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.showError("");

    if (!this.submitHandler) {
      return;
    }

    const formData = new FormData(this.form);
    const countsTowardCharge = formData.get("countsTowardCharge") === "on";
    const request: AddSponsorRequest = {
      bossName: String(formData.get("bossName") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      programName: countsTowardCharge ? STARTUP_FUNDING_PROGRAM_NAME : String(formData.get("programName") ?? ""),
      countsTowardCharge,
      note: String(formData.get("note") ?? ""),
      avatarDataUrl: this.avatarDataUrl
    };

    await this.submitHandler(request);
    this.form.reset();
    this.editableProgramName = "";
    this.clearAvatar();
    this.syncStartupProgramLock();
  }

  private async setAvatarFromSelectedFile(): Promise<void> {
    const file = this.avatarFileInput.files?.[0];
    if (!file) {
      return;
    }

    await this.setAvatarFromBlob(file);
    this.avatarFileInput.value = "";
  }

  private async setAvatarFromClipboard(): Promise<void> {
    try {
      this.avatarDataUrl = await readAvatarFromClipboard();
      this.avatarSource = "manual";
      this.matchedAvatarUrl = undefined;
      this.renderAvatarPreview();
      this.showError("");
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "读取头像失败");
    }
  }

  private async handlePaste(event: ClipboardEvent): Promise<void> {
    const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
    if (!file) {
      return;
    }

    event.preventDefault();
    await this.setAvatarFromBlob(file);
  }

  private async setAvatarFromBlob(file: Blob): Promise<void> {
    try {
      this.avatarDataUrl = await compressAvatarFile(file);
      this.avatarSource = "manual";
      this.matchedAvatarUrl = undefined;
      this.renderAvatarPreview();
      this.showError("");
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "头像处理失败");
    }
  }

  private clearAvatar(): void {
    this.avatarDataUrl = undefined;
    this.avatarSource = "empty";
    this.matchedAvatarUrl = undefined;
    this.renderAvatarPreview();
  }

  private async matchExistingSponsorAvatar(): Promise<void> {
    if (this.avatarSource === "manual") {
      return;
    }

    const bossName = this.normalizedBossName(this.bossNameInput.value);
    const requestId = (this.matchRequestId += 1);
    const match = this.latestSponsorWithAvatar(bossName);

    if (!match?.avatarUrl) {
      if (this.avatarSource === "matched") {
        this.clearAvatar();
      }
      return;
    }

    if (this.avatarSource === "matched" && this.matchedAvatarUrl === match.avatarUrl) {
      return;
    }

    try {
      const response = await fetch(match.avatarUrl);
      if (!response.ok) {
        return;
      }

      const avatarDataUrl = await compressAvatarFile(await response.blob());
      if (requestId !== this.matchRequestId || this.isManualAvatarSource()) {
        return;
      }

      this.avatarDataUrl = avatarDataUrl;
      this.avatarSource = "matched";
      this.matchedAvatarUrl = match.avatarUrl;
      this.renderAvatarPreview();
    } catch {
      // Existing avatars are a convenience; failed auto-import should not block entry.
    }
  }

  private latestSponsorWithAvatar(bossName: string): SponsorRecord | undefined {
    if (!bossName) {
      return undefined;
    }

    return [...this.knownSponsors]
      .filter((record) => this.normalizedBossName(record.bossName) === bossName && Boolean(record.avatarUrl))
      .sort((left, right) => right.createdAt - left.createdAt)[0];
  }

  private normalizedBossName(name: string): string {
    return name.trim().toLocaleLowerCase("zh-CN");
  }

  private isManualAvatarSource(): boolean {
    return this.avatarSource === "manual";
  }

  private renderAvatarPreview(): void {
    this.avatarPreview.classList.toggle("has-image", Boolean(this.avatarDataUrl));
    this.avatarPreview.style.backgroundImage = this.avatarDataUrl ? `url("${this.avatarDataUrl}")` : "";
    this.avatarPreview.textContent = this.avatarDataUrl ? "" : "头像";
    this.clearAvatarButton.disabled = !this.formEnabled || !this.avatarDataUrl;
  }

  private syncStartupProgramLock(): void {
    if (this.countsTowardChargeInput.checked) {
      if (this.programNameInput.value && this.programNameInput.value !== STARTUP_FUNDING_PROGRAM_NAME) {
        this.editableProgramName = this.programNameInput.value;
      }

      this.programNameInput.value = STARTUP_FUNDING_PROGRAM_NAME;
      this.programNameInput.readOnly = true;
      this.programNameInput.classList.add("is-readonly");
      return;
    }

    this.programNameInput.readOnly = false;
    this.programNameInput.classList.remove("is-readonly");
    if (this.programNameInput.value === STARTUP_FUNDING_PROGRAM_NAME) {
      this.programNameInput.value = this.editableProgramName;
    }
  }

  private requiredInput(name: string): HTMLInputElement {
    const element = this.form.elements.namedItem(name);
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`Missing input: ${name}`);
    }

    return element;
  }

  private requiredElement<T extends HTMLElement>(
    selector: string,
    constructor: { new (...args: any[]): T }
  ): T {
    const element = this.form.querySelector(selector);
    if (!(element instanceof constructor)) {
      throw new Error(`Missing element: ${selector}`);
    }

    return element;
  }
}
