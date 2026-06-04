import type { AddSponsorRequest } from "../../shared/types";
import { STARTUP_FUNDING_PROGRAM_NAME } from "../../shared/displayUnits";

type SubmitHandler = (request: AddSponsorRequest) => Promise<void>;

export class SponsorFormController {
  private submitHandler: SubmitHandler | null = null;
  private readonly programNameInput: HTMLInputElement;
  private readonly countsTowardChargeInput: HTMLInputElement;
  private editableProgramName = "";

  public constructor(
    private readonly form: HTMLFormElement,
    private readonly errorElement: HTMLElement
  ) {
    this.programNameInput = this.requiredInput("programName");
    this.countsTowardChargeInput = this.requiredInput("countsTowardCharge");
    this.form.addEventListener("submit", (event) => void this.handleSubmit(event));
    this.countsTowardChargeInput.addEventListener("change", () => this.syncStartupProgramLock());
    this.syncStartupProgramLock();
  }

  public onSubmit(handler: SubmitHandler): void {
    this.submitHandler = handler;
  }

  public showError(message: string): void {
    this.errorElement.textContent = message;
  }

  public setEnabled(enabled: boolean): void {
    this.form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>(
      "input, textarea, button"
    ).forEach((element) => {
      element.disabled = !enabled;
    });

    if (enabled) {
      this.syncStartupProgramLock();
    }
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
      note: String(formData.get("note") ?? "")
    };

    await this.submitHandler(request);
    this.form.reset();
    this.editableProgramName = "";
    this.syncStartupProgramLock();
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
}
