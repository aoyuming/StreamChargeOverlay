import { describe, expect, it } from "vitest";
import type { DerivedAppState } from "../../shared/types";
import { RealtimeHub, STATE_UPDATED_EVENT } from "../services/RealtimeHub";

const emptyState: DerivedAppState = {
  targetAmount: 1000,
  slogan: "slogan",
  sponsors: [],
  chargeConsumedAmount: 0,
  totalAmount: 0,
  progressPercent: 0,
  goalReached: false,
  ranking: [],
  programQueue: []
};

describe("RealtimeHub", () => {
  it("broadcasts updates only to the selected room", () => {
    const events: Array<{ roomSlug: string; event: string; state: DerivedAppState }> = [];
    const io = {
      to(roomSlug: string) {
        return {
          emit(event: string, state: DerivedAppState) {
            events.push({ roomSlug, event, state });
          }
        };
      }
    };

    new RealtimeHub(io as never).broadcastState("alpha", emptyState);

    expect(events).toEqual([{ roomSlug: "alpha", event: STATE_UPDATED_EVENT, state: emptyState }]);
  });
});
