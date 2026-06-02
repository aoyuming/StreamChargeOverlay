import type { SponsorRecord } from "../../shared/types";
import { buildRootUnitActionText, neutralizePublicText } from "../../shared/displayUnits";
import { BurstParticles } from "./BurstParticles";

export class SponsorBurst {
  private hideTimer = 0;

  public constructor(
    private readonly rootElement: HTMLElement,
    private readonly titleElement: HTMLElement,
    private readonly noteElement: HTMLElement,
    private readonly particles: BurstParticles
  ) {}

  public show(record: SponsorRecord): void {
    window.clearTimeout(this.hideTimer);
    this.titleElement.textContent = buildRootUnitActionText(record.bossName, record.amount);
    this.noteElement.textContent = neutralizePublicText(record.note || record.programName);

    this.rootElement.classList.remove("is-visible");
    requestAnimationFrame(() => this.rootElement.classList.add("is-visible"));
    this.particles.explode(this.getBurstOrigin());
    this.hideTimer = window.setTimeout(() => {
      this.rootElement.classList.remove("is-visible");
    }, 4200);
  }

  private getBurstOrigin() {
    const rect = this.rootElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
}
