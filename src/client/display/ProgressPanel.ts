import type { DerivedAppState } from "../../shared/types";
import { formatRootUnits } from "../../shared/displayUnits";

const WAITING_STATUS_TEXT = "名场面马上开演";

export class ProgressPanel {
  public constructor(
    private readonly totalElement: HTMLElement,
    private readonly targetElement: HTMLElement,
    private readonly progressFill: HTMLElement,
    private readonly percentElement: HTMLElement,
    private readonly statusElement: HTMLElement
  ) {}

  public render(state: DerivedAppState): void {
    this.totalElement.textContent = formatRootUnits(state.totalAmount);
    this.targetElement.textContent = formatRootUnits(state.targetAmount);
    this.percentElement.textContent = `${Math.round(state.progressPercent)}%`;
    this.statusElement.textContent = state.goalReached ? "可以开始" : WAITING_STATUS_TEXT;
    this.statusElement.classList.toggle("is-ready", state.goalReached);
    this.progressFill.style.setProperty("--progress", `${state.progressPercent}%`);
  }

  public pulse(): void {
    this.progressFill.classList.remove("is-pulsing");
    requestAnimationFrame(() => this.progressFill.classList.add("is-pulsing"));
  }
}
