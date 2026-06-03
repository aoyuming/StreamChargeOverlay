import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../ApiClient";
import { RoomContext } from "../RoomContext";

const stateResponse = {
  targetAmount: 1000,
  slogan: "slogan",
  sponsors: [],
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
      programName: "program"
    });

    expect(fetch).toHaveBeenCalledWith("/rooms/alpha/api/sponsors", expect.any(Object));
  });
});
