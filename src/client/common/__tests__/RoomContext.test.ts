import { describe, expect, it } from "vitest";
import { RoomContext } from "../RoomContext";

describe("RoomContext", () => {
  it("maps legacy pages to the default room", () => {
    expect(RoomContext.fromPath("/display.html").slug).toBe("default");
    expect(RoomContext.fromPath("/admin.html").slug).toBe("default");
  });

  it("extracts the room slug from room-scoped pages", () => {
    expect(RoomContext.fromPath("/rooms/alpha/display.html").slug).toBe("alpha");
    expect(RoomContext.fromPath("/rooms/boss-room/admin.html").slug).toBe("boss-room");
  });

  it("rejects unsafe slugs and falls back to default", () => {
    expect(RoomContext.fromPath("/rooms/../display.html").slug).toBe("default");
    expect(RoomContext.fromPath("/rooms/中文/display.html").slug).toBe("default");
  });
});
