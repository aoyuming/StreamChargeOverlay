import { describe, expect, it } from "vitest";
import type { DerivedAppState, SponsorRecord } from "../../../shared/types";
import { DisplayEffectCoordinator } from "../DisplayEffectCoordinator";

const sponsor = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
  id: "sponsor-1",
  bossName: "Boss",
  amount: 100,
  programName: "Program",
  note: "",
  countsTowardCharge: true,
  createdAt: 1,
  ...overrides
});

const state = (overrides: Partial<DerivedAppState> = {}): DerivedAppState => ({
  targetAmount: 1000,
  slogan: "",
  chargeConsumedAmount: 0,
  sponsors: [],
  totalAmount: 0,
  progressPercent: 0,
  goalReached: false,
  ranking: [],
  programQueue: [],
  ...overrides
});

describe("DisplayEffectCoordinator", () => {
  it("does not treat existing sponsors as new on the first render", () => {
    const coordinator = new DisplayEffectCoordinator();

    const event = coordinator.update(state({ sponsors: [sponsor()] }));

    expect(event.latestNewSponsor).toBeUndefined();
    expect(event.sponsorEffect).toBeUndefined();
  });

  it("plays the current charge-stage sponsor effect for a new sponsor", () => {
    const coordinator = new DisplayEffectCoordinator();
    coordinator.update(state({ sponsors: [sponsor({ id: "known" })], totalAmount: 200, progressPercent: 20 }));

    const event = coordinator.update(
      state({
        sponsors: [
          sponsor({ id: "known" }),
          sponsor({ id: "new", amount: 80, countsTowardCharge: false, createdAt: 2 })
        ],
        totalAmount: 200,
        progressPercent: 88
      })
    );

    expect(event.latestNewSponsor?.id).toBe("new");
    expect(event.sponsorEffect).toBe("inferno");
    expect(event.shouldPulseProgress).toBe(false);
  });

  it("plays the dianjiang effect only when the marker changes after first render", () => {
    const coordinator = new DisplayEffectCoordinator();

    expect(coordinator.update(state({ lastDianjiangEffectAt: 100 })).shouldPlayDianjiangEffect).toBe(false);
    expect(coordinator.update(state({ lastDianjiangEffectAt: 100 })).shouldPlayDianjiangEffect).toBe(false);
    expect(coordinator.update(state({ lastDianjiangEffectAt: 200 })).shouldPlayDianjiangEffect).toBe(true);
  });
});
