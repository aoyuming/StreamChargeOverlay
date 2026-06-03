import type { DerivedAppState, SponsorRecord } from "../../shared/types";
import { formatDisplayName, formatRootUnits, neutralizePublicText } from "../../shared/displayUnits";

export type ProgressEffect = "ice" | "energy" | "fire" | "lightning";

const EFFECT_CLASSES = ["is-ice", "is-energy", "is-fire", "is-lightning"];
const MIN_SCROLL_SECONDS = 36;
const MAX_SCROLL_SECONDS = 160;
const SECONDS_PER_SPONSOR = 4;

export const progressEffectFor = (progressPercent: number): ProgressEffect => {
  const percent = Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : 0;

  if (percent >= 100) {
    return "lightning";
  }

  if (percent >= 80) {
    return "fire";
  }

  if (percent >= 40) {
    return "energy";
  }

  return "ice";
};

export class ProgressPanel {
  public constructor(
    private readonly currentBossListElement: HTMLElement,
    private readonly progressTrack: HTMLElement,
    private readonly progressFill: HTMLElement,
    private readonly percentElement: HTMLElement
  ) {}

  public render(state: DerivedAppState, sponsors: SponsorRecord[]): void {
    this.renderCurrentSponsors(sponsors);
    this.percentElement.textContent = `${Math.round(state.progressPercent)}%`;
    this.progressFill.style.setProperty("--progress", `${state.progressPercent}%`);
    this.applyEffect(progressEffectFor(state.progressPercent));
  }

  public pulse(): void {
    this.progressFill.classList.remove("is-pulsing");
    requestAnimationFrame(() => this.progressFill.classList.add("is-pulsing"));
  }

  private renderCurrentSponsors(sponsors: SponsorRecord[]): void {
    const sortedSponsors = [...sponsors].sort((left, right) => right.createdAt - left.createdAt);
    const loopSponsors = sortedSponsors.length > 1 ? [...sortedSponsors, ...sortedSponsors] : sortedSponsors;
    this.currentBossListElement.classList.toggle("is-scrolling-slow", sortedSponsors.length > 1);
    this.currentBossListElement.style.setProperty(
      "--current-boss-scroll-duration",
      `${this.scrollDurationSeconds(sortedSponsors.length)}s`
    );

    if (loopSponsors.length === 0) {
      this.currentBossListElement.replaceChildren(this.createEmptyBossCard());
      return;
    }

    this.currentBossListElement.replaceChildren(...loopSponsors.map((sponsor) => this.createBossCard(sponsor)));
  }

  private createBossCard(sponsor: SponsorRecord): HTMLElement {
    const item = this.currentBossListElement.ownerDocument.createElement("li");
    item.className = "current-boss-item";

    const label = this.currentBossListElement.ownerDocument.createElement("span");
    label.className = "current-boss-label";
    label.textContent = "最新入场";

    const name = this.currentBossListElement.ownerDocument.createElement("strong");
    name.className = "current-boss-name";
    name.textContent = formatDisplayName(sponsor.bossName);

    const meta = this.currentBossListElement.ownerDocument.createElement("span");
    meta.className = "current-boss-meta";
    meta.textContent = `${formatRootUnits(sponsor.amount)} / ${neutralizePublicText(sponsor.programName || sponsor.note || "名场面")}`;

    item.append(label, name, meta);
    return item;
  }

  private createEmptyBossCard(): HTMLElement {
    const item = this.currentBossListElement.ownerDocument.createElement("li");
    item.className = "current-boss-item is-empty";
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
}
