import type { AddSponsorRequest } from "../../shared/types";

type SubmitHandler = (request: AddSponsorRequest) => Promise<void>;

export class SponsorFormController {
  private submitHandler: SubmitHandler | null = null;

  public constructor(
    private readonly form: HTMLFormElement,
    private readonly errorElement: HTMLElement
  ) {
    this.form.addEventListener("submit", (event) => void this.handleSubmit(event));
  }

  public onSubmit(handler: SubmitHandler): void {
    this.submitHandler = handler;
  }

  public showError(message: string): void {
    this.errorElement.textContent = message;
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.showError("");

    if (!this.submitHandler) {
      return;
    }

    const formData = new FormData(this.form);
    const request: AddSponsorRequest = {
      bossName: String(formData.get("bossName") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      programName: String(formData.get("programName") ?? ""),
      countsTowardCharge: formData.get("countsTowardCharge") === "on",
      note: String(formData.get("note") ?? "")
    };

    await this.submitHandler(request);
    this.form.reset();
  }
}
