import { describe, expect, it } from "vitest";
import type { DerivedAppState } from "../../shared/types";
import { RealtimeHub, STATE_UPDATED_EVENT } from "../services/RealtimeHub";

const emptyState: DerivedAppState = {
  targetAmount: 1000,
  slogan: "slogan",
  sponsors: [],
  chargeConsumedAmount: 0,
  chargeAdjustmentAmount: 0,
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

  it("logs a compact state summary when broadcasting updates", () => {
    const entries: Array<{ module: string; message: string; details?: Record<string, unknown> }> = [];
    const logger = {
      info(module: string, message: string, details?: Record<string, unknown>) {
        entries.push({ module, message, details });
      },
      warn() {},
      error() {}
    };
    const io = {
      to() {
        return {
          emit() {}
        };
      }
    };
    const state: DerivedAppState = {
      ...emptyState,
      totalAmount: 280,
      sponsors: [
        {
          id: "sponsor-1",
          bossName: "日志老板",
          amount: 280,
          programName: "测试节目",
          note: "",
          countsTowardCharge: true,
          createdAt: 1
        }
      ],
      programQueue: [
        {
          id: "sponsor-1",
          bossName: "日志老板",
          amount: 280,
          programName: "测试节目",
          note: "",
          countsTowardCharge: true,
          createdAt: 1
        }
      ]
    };

    new (RealtimeHub as any)(io, logger).broadcastState("alpha", state);

    expect(entries).toEqual([
      {
        module: "realtime",
        message: "state broadcast",
        details: expect.objectContaining({
          roomSlug: "alpha",
          sponsorCount: 1,
          todayCount: 1,
          totalAmount: 280
        })
      }
    ]);
  });
});
