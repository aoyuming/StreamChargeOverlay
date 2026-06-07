import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../ApiClient";
import { RoomContext } from "../RoomContext";

const stateResponse = {
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

describe("ApiClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => stateResponse
      }))
    );
  });

  it("keeps default room requests on legacy API paths", async () => {
    await new ApiClient(new RoomContext("default")).getState();

    expect(fetch).toHaveBeenCalledWith("/api/state", expect.any(Object));
  });

  it("prefixes API requests with the room slug for room-scoped pages", async () => {
    await new ApiClient(new RoomContext("alpha")).addSponsor({
      bossName: "boss",
      amount: 100,
      programName: "program",
      countsTowardCharge: true
    });

    expect(fetch).toHaveBeenCalledWith("/rooms/alpha/api/sponsors", expect.any(Object));
  });

  it("posts the start dianjiang command through the room-scoped API", async () => {
    await new ApiClient(new RoomContext("alpha")).startDianjiang();

    expect(fetch).toHaveBeenCalledWith(
      "/rooms/alpha/api/charge/start",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("updates current startup funding through the room-scoped API", async () => {
    await new ApiClient(new RoomContext("alpha")).updateCurrentChargeAmount(188);

    expect(fetch).toHaveBeenCalledWith(
      "/rooms/alpha/api/charge/current",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ totalAmount: 188 }) })
    );
  });

  it("updates sponsor amount through the room-scoped API", async () => {
    await new ApiClient(new RoomContext("alpha")).updateSponsorAmount("sponsor id", 420);

    expect(fetch).toHaveBeenCalledWith(
      "/rooms/alpha/api/sponsors/sponsor%20id/amount",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ amount: 420 }) })
    );
  });

  it("updates sponsor avatars through the room-scoped API", async () => {
    await new ApiClient(new RoomContext("alpha")).updateSponsorAvatar("sponsor id", "data:image/webp;base64,next");

    expect(fetch).toHaveBeenCalledWith(
      "/rooms/alpha/api/sponsors/sponsor%20id/avatar",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ avatarDataUrl: "data:image/webp;base64,next" })
      })
    );
  });

  it("updates all sponsor fields through the room-scoped API", async () => {
    await new ApiClient(new RoomContext("alpha")).updateSponsor("sponsor id", {
      bossName: "boss",
      amount: 420,
      programName: "program",
      note: "note",
      countsTowardCharge: false,
      createdAt: 1780500000000,
      avatarDataUrl: null
    });

    expect(fetch).toHaveBeenCalledWith(
      "/rooms/alpha/api/sponsors/sponsor%20id",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          bossName: "boss",
          amount: 420,
          programName: "program",
          note: "note",
          countsTowardCharge: false,
          createdAt: 1780500000000,
          avatarDataUrl: null
        })
      })
    );
  });

  it("soft-removes one sponsor and all current sponsors from today's list", async () => {
    const client = new ApiClient(new RoomContext("alpha"));

    await client.removeSponsorFromToday("sponsor id");
    await client.removeTodaySponsors();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/rooms/alpha/api/sponsors/sponsor%20id/remove-from-today",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/rooms/alpha/api/sponsors/remove-from-today",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("adds a sponsor back to today's list through the room-scoped API", async () => {
    await new ApiClient(new RoomContext("alpha")).addSponsorToToday("sponsor id");

    expect(fetch).toHaveBeenCalledWith(
      "/rooms/alpha/api/sponsors/sponsor%20id/add-to-today",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("uses admin deletion endpoints for bulk delete and recycle-bin cleanup", async () => {
    const client = new ApiClient(new RoomContext("alpha"));

    await client.deleteAllSponsors();
    await client.deleteSponsorPermanently("trash id");
    await client.clearSponsorTrash();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/rooms/alpha/api/sponsors",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/rooms/alpha/api/sponsors/trash/trash%20id",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/rooms/alpha/api/sponsors/trash",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("uses global room and auth endpoints even on room-scoped pages", async () => {
    const client = new ApiClient(new RoomContext("alpha"));

    await client.getRooms();
    await client.createRoom("测试房");
    await client.deleteRoom("room-abc");
    await client.login("secret");
    await client.updateRoomViewerPassword("room-abc", "room-secret");
    await client.logout();

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/rooms", expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/rooms",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "测试房" }) })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/rooms/room-abc",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "/api/auth/login",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "secret", roomSlug: "alpha" }) })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "/api/rooms/room-abc/viewer-password",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ password: "room-secret" }) })
    );
    expect(fetch).toHaveBeenNthCalledWith(6, "/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
