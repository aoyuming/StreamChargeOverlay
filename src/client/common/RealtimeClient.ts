import { io, type Socket } from "socket.io-client";
import type { DerivedAppState } from "../../shared/types";
import { RoomContext } from "./RoomContext";

type StateListener = (state: DerivedAppState) => void;
type SocketLike = Pick<Socket, "on">;
type SocketFactory = (options: { query: { roomSlug: string } }) => SocketLike;

// Receives server state updates for one room. Page classes decide how to render.
export class RealtimeClient {
  private readonly socket: SocketLike;

  public constructor(roomContext = new RoomContext("default"), socketFactory: SocketFactory = io) {
    this.socket = socketFactory({ query: { roomSlug: roomContext.slug } });
  }

  public onStateUpdated(listener: StateListener): void {
    this.socket.on("state:updated", listener);
  }
}
