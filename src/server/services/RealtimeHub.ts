import type { Server as SocketServer } from "socket.io";
import type { DerivedAppState } from "../../shared/types";

export const STATE_UPDATED_EVENT = "state:updated";

// 把实时通信封装起来，业务层只需要说“状态更新了”。
export class RealtimeHub {
  public constructor(private readonly io: SocketServer) {}

  public broadcastState(state: DerivedAppState): void {
    this.io.emit(STATE_UPDATED_EVENT, state);
  }

  public sendInitialState(socketId: string, state: DerivedAppState): void {
    this.io.to(socketId).emit(STATE_UPDATED_EVENT, state);
  }
}
