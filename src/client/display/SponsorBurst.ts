import type { SponsorRecord } from "../../shared/types";
import { buildRootUnitActionText, buildSponsorSpeechText, neutralizePublicText } from "../../shared/displayUnits";
import { BurstParticles } from "./BurstParticles";

const MIN_BURST_DURATION_MS = 4200;
const MAX_BURST_DURATION_MS = 9500;
const BURST_DURATION_BASE_MS = 2800;
const BURST_DURATION_MS_PER_CHAR = 95;
const BURST_DURATION_FREE_CHARS = 24;

export const estimateSponsorBurstDurationMs = (speechText: string): number => {
  const billableTextLength = Math.max(0, speechText.trim().length - BURST_DURATION_FREE_CHARS);
  const estimated = BURST_DURATION_BASE_MS + billableTextLength * BURST_DURATION_MS_PER_CHAR;

  return Math.min(MAX_BURST_DURATION_MS, Math.max(MIN_BURST_DURATION_MS, Math.round(estimated)));
};

export class SponsorBurst {
  private hideTimer = 0;

  public constructor(
    private readonly rootElement: HTMLElement,
    private readonly avatarElement: HTMLElement,
    private readonly titleElement: HTMLElement,
    private readonly programElement: HTMLElement,
    private readonly noteElement: HTMLElement,
    private readonly particles: BurstParticles
  ) {}

  public show(record: SponsorRecord, speechText?: string): void {
    window.clearTimeout(this.hideTimer);
    this.renderAvatar(record);
    this.titleElement.textContent = buildRootUnitActionText(record.bossName, record.amount);
    this.programElement.textContent = neutralizePublicText(record.programName ?? "");
    const note = neutralizePublicText(record.note ?? "");
    this.noteElement.textContent = note ? `备注:${note}` : "";
    const durationMs = estimateSponsorBurstDurationMs(speechText || buildSponsorSpeechText(record));
    this.rootElement.style.setProperty("--burst-duration", `${durationMs}ms`);

    this.rootElement.classList.remove("is-visible");
    window.requestAnimationFrame(() => this.rootElement.classList.add("is-visible"));
    this.particles.explode(this.getBurstOrigin());
    this.hideTimer = window.setTimeout(() => {
      this.rootElement.classList.remove("is-visible");
    }, durationMs);
  }

  private getBurstOrigin() {
    const rect = this.rootElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  private renderAvatar(record: SponsorRecord): void {
    this.avatarElement.className = `burst-avatar${record.avatarUrl ? " has-image" : " is-placeholder"}`;
    this.avatarElement.style.backgroundImage = record.avatarUrl ? `url("${record.avatarUrl}")` : "";
    this.avatarElement.textContent = record.avatarUrl ? "" : this.avatarInitial(record.bossName);
  }

  private avatarInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "B";
  }
}
