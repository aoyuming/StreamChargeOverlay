import type { UpdateSettingsRequest } from "../../shared/types";

type SettingsSubmitHandler = (request: UpdateSettingsRequest) => Promise<void>;

export class TargetFormController {
  private submitHandler: SettingsSubmitHandler | null = null;

  public constructor(private readonly form: HTMLFormElement) {
    this.form.addEventListener("submit", (event) => void this.handleSubmit(event));
  }

  public onSubmit(handler: SettingsSubmitHandler): void {
    this.submitHandler = handler;
  }

  public setEnabled(enabled: boolean): void {
    this.form.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach((element) => {
      element.disabled = !enabled;
    });
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!this.submitHandler) {
      return;
    }

    const formData = new FormData(this.form);
    await this.submitHandler({
      targetAmount: Number(formData.get("targetAmount") ?? 1000),
      slogan: String(formData.get("slogan") ?? "")
    });
  }
}
