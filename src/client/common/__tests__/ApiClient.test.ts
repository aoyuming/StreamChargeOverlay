import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../ApiClient";
import { RoomContext } from "../RoomContext";

const stateResponse = {
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

  it("updates sponsor amount through the room-scoped API", async () => {
    await new ApiClient(new RoomContext("alpha")).updateSponsorAmount("sponsor id", 420);

    expect(fetch).toHaveBeenCalledWith(
      "/rooms/alpha/api/sponsors/sponsor%20id/amount",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ amount: 420 }) })
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
});
