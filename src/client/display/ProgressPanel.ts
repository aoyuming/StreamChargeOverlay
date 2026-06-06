import type { DerivedAppState, SponsorRecord } from "../../shared/types";
import { formatDisplayName, formatRootUnits, neutralizePublicText } from "../../shared/displayUnits";
import { amountRarityClass } from "./amountRarity";

export type ProgressEffect = "ice" | "energy" | "water" | "steam" | "fire" | "inferno" | "lightning";

export interface ProgressEffectRenderer {
  setState(effect: ProgressEffect, progressPercent: number): void;
}

const EFFECT_CLASSES = ["is-ice", "is-energy", "is-water", "is-steam", "is-fire", "is-inferno", "is-lightning"];
const MIN_SCROLL_SECONDS = 36;
const MAX_SCROLL_SECONDS = 160;
const SECONDS_PER_SPONSOR = 4;

export const progressEffectFor = (progressPercent: number): ProgressEffect => {
  const percent = Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : 0;

  if (percent >= 100) {
    return "lightning";
  }

  if (percent >= 70) {
    return "fire";
  }

  if (percent >= 60) {
    return "steam";
  }

  if (percent >= 30) {
    return "water";
  }

  return "ice";
};

export class ProgressPanel {
  public constructor(
    private readonly currentBossListElement: HTMLElement,
    private readonly progressTrack: HTMLElement,
    private readonly progressFill: HTMLElement | SVGElement,
    private readonly sloganElement: HTMLElement,
    private readonly percentElement: HTMLElement,
    private readonly progressEffects?: ProgressEffectRenderer
  ) {}

  public render(state: DerivedAppState, sponsors: SponsorRecord[]): void {
    this.renderCurrentSponsors(sponsors);
    this.sloganElement.textContent = neutralizePublicText(state.slogan) || "充能进度";
    this.percentElement.textContent = this.formatChargeGoal(state);
    const progress = `${state.progressPercent}%`;
    this.progressTrack.style.setProperty("--progress", progress);
    this.progressFill.style.setProperty("--progress", progress);
    this.progressFill.setAttribute("width", progress);
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
    const noteText = neutralizePublicText(sponsor.note);
    item.className = `current-boss-row ${this.amountTierClass(sponsor.amount)}${sponsor.countsTowardCharge ? "" : " is-program-only"}${
      noteText ? "" : " has-empty-note"
    }`;

    const avatar = this.createAvatarElement(sponsor, "current-boss-avatar");

    const name = this.currentBossListElement.ownerDocument.createElement("strong");
    name.className = "current-boss-name";
    name.textContent = formatDisplayName(sponsor.bossName);

    const note = this.currentBossListElement.ownerDocument.createElement("span");
    note.className = "current-boss-note";
    note.textContent = noteText;

    const program = this.currentBossListElement.ownerDocument.createElement("span");
    program.className = "current-boss-program";
    program.textContent = neutralizePublicText(sponsor.programName || "等待节目");

    const amount = this.currentBossListElement.ownerDocument.createElement("span");
    amount.className = `current-boss-amount amount-rarity ${amountRarityClass(sponsor.amount)}`;
    amount.textContent = formatRootUnits(sponsor.amount);

    item.append(avatar, name, program, note, amount);
    return item;
  }

  private createAvatarElement(sponsor: SponsorRecord, className: string): HTMLElement {
    const avatar = this.currentBossListElement.ownerDocument.createElement("span");
    avatar.className = `${className}${sponsor.avatarUrl ? " has-image" : " is-placeholder"}`;
    avatar.style.setProperty("background-image", sponsor.avatarUrl ? `url("${sponsor.avatarUrl}")` : "");
    avatar.textContent = sponsor.avatarUrl ? "" : this.avatarInitial(sponsor.bossName);
    return avatar;
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

  private avatarInitial(name: string): string {
    return formatDisplayName(name).charAt(0).toUpperCase() || "B";
  }

  private applyEffect(effect: ProgressEffect): void {
    this.progressTrack.classList.remove(...EFFECT_CLASSES);
    this.progressTrack.classList.add(`is-${effect}`);
  }

  private formatChargeGoal(state: DerivedAppState): string {
    return `${formatRootUnits(state.totalAmount)}（${formatRootUnits(state.targetAmount)}）`;
  }
}
