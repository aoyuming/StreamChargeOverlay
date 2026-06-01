import { io, type Socket } from "socket.io-client";
import type { DerivedAppState } from "../../shared/types";

type StateListener = (state: DerivedAppState) => void;

// Socket.IO 只负责接收服务端状态广播，页面渲染逻辑放在各自 App 类里。
export class RealtimeClient {
  private readonly socket: Socket;

  public constructor() {
    this.socket = io();
  }

  public onStateUpdated(listener: StateListener): void {
    this.socket.on("state:updated", listener);
  }
}
