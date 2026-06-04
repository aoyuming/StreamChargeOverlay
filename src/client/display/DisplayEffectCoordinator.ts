import type { DerivedAppState, SponsorRecord } from "../../shared/types";
import type { ProgressEffect } from "./ProgressPanel";

export interface DisplayEffectEvent {
  latestNewSponsor?: SponsorRecord;
  shouldPulseProgress: boolean;
  shouldPlayDianjiangEffect: boolean;
  sponsorEffect?: ProgressEffect;
}

export const sponsorEffectForAmount = (amount: number): ProgressEffect => {
  if (!Number.isFinite(amount) || amount < 101) {
    return "ice";
  }

  if (amount < 200) {
    return "fire";
  }

  if (amount < 400) {
    return "inferno";
  }

  return "lightning";
};

export class DisplayEffectCoordinator {
  private knownSponsorIds = new Set<string>();
  private lastDianjiangEffectAt: number | undefined;
  private lastTotalAmount = 0;
  private hasRendered = false;

  public update(state: DerivedAppState): DisplayEffectEvent {
    const latestNewSponsor = this.findLatestNewSponsor(state);
    const shouldPlayDianjiangEffect = this.shouldPlayDianjiangEffect(state.lastDianjiangEffectAt);
    const event: DisplayEffectEvent = {
      latestNewSponsor,
      shouldPulseProgress: state.totalAmount > this.lastTotalAmount,
      shouldPlayDianjiangEffect,
      sponsorEffect: latestNewSponsor ? sponsorEffectForAmount(latestNewSponsor.amount) : undefined
    };

    this.knownSponsorIds = new Set(state.sponsors.map((record) => record.id));
    this.lastDianjiangEffectAt = state.lastDianjiangEffectAt;
    this.lastTotalAmount = state.totalAmount;
    this.hasRendered = true;

    return event;
  }

  private findLatestNewSponsor(state: DerivedAppState): SponsorRecord | undefined {
    if (!this.hasRendered) {
      return undefined;
    }

    return state.sponsors
      .filter((record) => !this.knownSponsorIds.has(record.id))
      .sort((left, right) => right.createdAt - left.createdAt)[0];
  }

  private shouldPlayDianjiangEffect(lastDianjiangEffectAt: number | undefined): boolean {
    if (!this.hasRendered || !Number.isFinite(lastDianjiangEffectAt)) {
      return false;
    }

    return lastDianjiangEffectAt !== this.lastDianjiangEffectAt;
  }
}
