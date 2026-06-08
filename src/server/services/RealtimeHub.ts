import type { Server as SocketServer } from "socket.io";
import type { DerivedAppState } from "../../shared/types";
import type { ServerLogSink } from "../logging/ServerLogger";

export const STATE_UPDATED_EVENT = "state:updated";

// Keeps Socket.IO details out of the business layer.
export class RealtimeHub {
  public constructor(private readonly io: SocketServer, private readonly logger?: ServerLogSink) {}

  public broadcastState(roomSlug: string, state: DerivedAppState): void {
    this.io.to(roomSlug).emit(STATE_UPDATED_EVENT, state);
    this.logger?.info("realtime", "state broadcast", {
      roomSlug,
      ...this.stateSummary(state)
    });
  }

  public sendInitialState(socketId: string, state: DerivedAppState): void {
    this.io.to(socketId).emit(STATE_UPDATED_EVENT, state);
    this.logger?.info("realtime", "initial state sent", {
      socketId,
      ...this.stateSummary(state)
    });
  }

  private stateSummary(state: DerivedAppState): Record<string, number | boolean> {
    return {
      sponsorCount: state.sponsors.length,
      todayCount: state.programQueue.length,
      totalAmount: state.totalAmount,
      progressPercent: state.progressPercent,
      goalReached: state.goalReached
    };
  }
}
