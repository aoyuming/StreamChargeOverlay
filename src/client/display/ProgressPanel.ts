import type { DerivedAppState, SponsorRecord } from "../../shared/types";
import { formatDisplayName, formatRootUnits, neutralizePublicText } from "../../shared/displayUnits";

export type ProgressEffect = "ice" | "energy" | "fire" | "inferno" | "lightning";

export interface ProgressEffectRenderer {
  setState(effect: ProgressEffect, progressPercent: number): void;
}

const EFFECT_CLASSES = ["is-ice", "is-energy", "is-fire", "is-inferno", "is-lightning"];
const MIN_SCROLL_SECONDS = 36;
const MAX_SCROLL_SECONDS = 160;
const SECONDS_PER_SPONSOR = 4;

export const progressEffectFor = (progressPercent: number): ProgressEffect => {
  const percent = Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : 0;

  if (percent >= 100) {
    return "lightning";
  }

  if (percent >= 70) {
    return "inferno";
  }

  if (percent >= 40) {
    return "fire";
  }

  return "ice";
};

export class ProgressPanel {
  public constructor(
    private readonly currentBossListElement: HTMLElement,
    private readonly progressTrack: HTMLElement,
    private readonly progressFill: HTMLElement,
    private readonly sloganElement: HTMLElement,
    private readonly percentElement: HTMLElement,
    private readonly progressEffects?: ProgressEffectRenderer
  ) {}

  public render(state: DerivedAppState, sponsors: SponsorRecord[]): void {
    this.renderCurrentSponsors(sponsors);
    this.sloganElement.textContent = neutralizePublicText(state.slogan) || "充能进度";
    this.percentElement.textContent = this.formatChargeGoal(state);
    this.progressTrack.style.setProperty("--progress", `${state.progressPercent}%`);
    this.progressFill.style.setProperty("--progress", `${state.progressPercent}%`);
    const effect = progressEffectFor(state.progressPercent);
    this.applyEffect(effect);
    this.progressEffects?.setState(effect, state.progressPercent);
  }

  public pulse(): void {
    this.progressFill.classList.remove("is-pulsing");
    requestAnimationFrame(() => this.progressFill.classList.add("is-pulsing"));
  }

  private renderCurrentSponsors(sponsors: SponsorRecord[]): void {
    const sortedSponsors = [...sponsors].sort((left, right) => right.createdAt - left.createdAt);
    this.currentBossListElement.style.setProperty(
      "--current-boss-scroll-duration",
      `${this.scrollDurationSeconds(sortedSponsors.length)}s`
    );

    if (sortedSponsors.length === 0) {
      this.currentBossListElement.classList.remove("is-scrolling-slow");
      this.currentBossListElement.replaceChildren(this.createEmptyBossCard());
      return;
    }

    this.currentBossListElement.replaceChildren(...sortedSponsors.map((sponsor) => this.createBossCard(sponsor)));
    const shouldScroll = sortedSponsors.length > 1 && this.currentBossListOverflows();
    this.currentBossListElement.classList.toggle("is-scrolling-slow", shouldScroll);

    if (shouldScroll) {
      this.currentBossListElement.replaceChildren(
        ...[...sortedSponsors, ...sortedSponsors].map((sponsor) => this.createBossCard(sponsor))
      );
    }
  }

  private createBossCard(sponsor: SponsorRecord): HTMLElement {
    const item = this.currentBossListElement.ownerDocument.createElement("li");
    item.className = `current-boss-row ${this.amountTierClass(sponsor.amount)}${sponsor.countsTowardCharge ? "" : " is-program-only"}`;

    const name = this.currentBossListElement.ownerDocument.createElement("strong");
    name.className = "current-boss-name";
    name.textContent = formatDisplayName(sponsor.bossName);

    const note = this.currentBossListElement.ownerDocument.createElement("span");
    note.className = "current-boss-note";
    note.textContent = neutralizePublicText(sponsor.note);

    const program = this.currentBossListElement.ownerDocument.createElement("span");
    program.className = "current-boss-program";
    program.textContent = neutralizePublicText(sponsor.programName || "等待节目");

    const amount = this.currentBossListElement.ownerDocument.createElement("span");
    amount.className = "current-boss-amount";
    amount.textContent = formatRootUnits(sponsor.amount);

    item.append(name, program, note, amount);
    return item;
  }

  private currentBossListOverflows(): boolean {
    const viewportHeight = this.currentBossListElement.parentElement?.clientHeight ?? this.currentBossListElement.clientHeight;
    return viewportHeight > 0 && this.currentBossListElement.scrollHeight > viewportHeight;
  }

  private amountTierClass(amount: number): string {
    const safeAmount = Number.isFinite(amount) ? amount : 0;

    if (safeAmount >= 1000) {
      return "is-tier-legend";
    }

    if (safeAmount >= 500) {
      return "is-tier-strong";
    }

    if (safeAmount >= 200) {
      return "is-tier-boosted";
    }

    return "is-tier-base";
  }

  private createEmptyBossCard(): HTMLElement {
    const item = this.currentBossListElement.ownerDocument.createElement("li");
    item.className = "current-boss-row is-empty";
    item.textContent = "等待大哥入场";
    return item;
  }

  private scrollDurationSeconds(sponsorCount: number): number {
    return Math.min(MAX_SCROLL_SECONDS, Math.max(MIN_SCROLL_SECONDS, sponsorCount * SECONDS_PER_SPONSOR));
  }

  private applyEffect(effect: ProgressEffect): void {
    this.progressTrack.classList.remove(...EFFECT_CLASSES);
    this.progressTrack.classList.add(`is-${effect}`);
  }

  private formatChargeGoal(state: DerivedAppState): string {
    if (state.goalReached) {
      return `${formatRootUnits(state.totalAmount)}（已达成，可以开始）`;
    }

    return `${formatRootUnits(state.totalAmount)}（目标${formatRootUnits(state.targetAmount)}）`;
  }
}
