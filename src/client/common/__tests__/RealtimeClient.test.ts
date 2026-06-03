import { describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "../RealtimeClient";
import { RoomContext } from "../RoomContext";

describe("RealtimeClient", () => {
  it("connects default room clients without changing legacy behavior", () => {
    const ioFactory = vi.fn(() => ({ on: vi.fn() }));

    new RealtimeClient(new RoomContext("default"), ioFactory);

    expect(ioFactory).toHaveBeenCalledWith({ query: { roomSlug: "default" } });
  });

  it("connects room-scoped clients with the selected room slug", () => {
    const ioFactory = vi.fn(() => ({ on: vi.fn() }));

    new RealtimeClient(new RoomContext("alpha"), ioFactory);

    expect(ioFactory).toHaveBeenCalledWith({ query: { roomSlug: "alpha" } });
  });
});
