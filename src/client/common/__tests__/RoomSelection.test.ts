import { describe, expect, it } from "vitest";
import { nextRoomSlug, preferredRoomSlug } from "../RoomSelection";

const rooms = [
  { slug: "wenrou", name: "温柔房", createdAt: 1 },
  { slug: "liyong", name: "李永房", createdAt: 2 },
  { slug: "room-59", name: "59房", createdAt: 3 }
];

describe("RoomSelection", () => {
  it("defaults legacy pages to the first selectable room", () => {
    expect(preferredRoomSlug(rooms, "default", "default")).toBe("wenrou");
  });

  it("keeps the current room when the URL already has a selectable room", () => {
    expect(preferredRoomSlug(rooms, "liyong", "default")).toBe("liyong");
  });

  it("cycles room selection without relying on a native select popup", () => {
    expect(nextRoomSlug(rooms, "wenrou")).toBe("liyong");
    expect(nextRoomSlug(rooms, "room-59")).toBe("wenrou");
    expect(nextRoomSlug(rooms, "default")).toBe("wenrou");
  });
});
