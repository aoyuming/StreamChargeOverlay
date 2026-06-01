import type { DerivedAppState } from "../../shared/types";
import { formatAmount } from "../common/format";

export class AdminSummaryView {
  public constructor(
    private readonly totalElement: HTMLElement,
    private readonly targetElement: HTMLInputElement,
    private readonly sloganElement: HTMLInputElement,
    private readonly statusElement: HTMLElement
  ) {}

  public render(state: DerivedAppState): void {
    this.totalElement.textContent = formatAmount(state.totalAmount);
    this.targetElement.value = String(state.targetAmount);
    this.sloganElement.value = state.slogan;
    this.statusElement.textContent = state.goalReached ? "已达成，可以开始" : "未达成，继续累积";
    this.statusElement.classList.toggle("is-ready", state.goalReached);
  }
}
