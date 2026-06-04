import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { DerivedAppState, SponsorRecord, StateRepository } from "../../shared/types";
import { ApiController } from "../controllers/ApiController";
import { MemoryStateRepository } from "./MemoryStateRepository";

class MemoryRoomRepositoryFactory {
  private readonly repositories = new Map<string, MemoryStateRepository>();

  public async getRepository(roomSlug: string): Promise<StateRepository> {
    let repository = this.repositories.get(roomSlug);
    if (!repository) {
      repository = new MemoryStateRepository();
      this.repositories.set(roomSlug, repository);
    }
    return repository;
  }
}

class FakeRealtimeHub {
  public readonly updates: Array<{ roomSlug: string; state: DerivedAppState }> = [];

  public broadcastState(roomSlug: string, state: DerivedAppState): void {
    this.updates.push({ roomSlug, state });
  }
}

class FakeSpeechService {
  public async createSponsorSpeech(_record: SponsorRecord) {
    return null;
  }
}

const listen = async (app: express.Express) => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

describe("ApiController room routing", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) {
      return;
    }
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  });

  it("keeps room-scoped sponsor data isolated", async () => {
    const app = express();
    const realtimeHub = new FakeRealtimeHub();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      realtimeHub,
      new FakeSpeechService(),
      "default"
    ).register(app);
    const running = await listen(app);
    server = running.server;

    await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bossName: "alpha boss", amount: 100, programName: "alpha program" })
    });

    const alpha = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/state`)).json()) as DerivedAppState;
    const beta = (await (await fetch(`${running.baseUrl}/rooms/beta/api/state`)).json()) as DerivedAppState;

    expect(alpha.sponsors.map((record) => record.bossName)).toEqual(["alpha boss"]);
    expect(beta.sponsors).toEqual([]);
    expect(realtimeHub.updates.map((update) => update.roomSlug)).toEqual(["alpha"]);
  });

  it("keeps legacy API routes mapped to the default room", async () => {
    const app = express();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      new FakeRealtimeHub(),
      new FakeSpeechService(),
      "default"
    ).register(app);
    const running = await listen(app);
    server = running.server;

    await fetch(`${running.baseUrl}/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bossName: "default boss", amount: 100, programName: "default program" })
    });

    const state = (await (await fetch(`${running.baseUrl}/api/state`)).json()) as DerivedAppState;

    expect(state.sponsors.map((record) => record.bossName)).toEqual(["default boss"]);
  });

  it("exposes room-scoped charge, amount edit, and today-list management routes", async () => {
    const app = express();
    const realtimeHub = new FakeRealtimeHub();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      realtimeHub,
      new FakeSpeechService(),
      "default"
    ).register(app);
    const running = await listen(app);
    server = running.server;

    await fetch(`${running.baseUrl}/rooms/alpha/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetAmount: 500, slogan: "alpha slogan" })
    });
    const added = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bossName: "alpha boss", amount: 300, programName: "alpha program", countsTowardCharge: true })
    })).json()) as DerivedAppState;
    const sponsorId = added.sponsors[0]?.id ?? "";

    const edited = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/amount`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 240 })
    })).json()) as DerivedAppState;
    const started = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/charge/start`, {
      method: "POST"
    })).json()) as DerivedAppState;
    const removed = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/remove-from-today`, {
      method: "POST"
    })).json()) as DerivedAppState;
    await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bossName: "next boss", amount: 100, programName: "next program", countsTowardCharge: false })
    });
    const bulkRemoved = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/remove-from-today`, {
      method: "POST"
    })).json()) as DerivedAppState;

    expect(edited.sponsors.find((record) => record.id === sponsorId)?.amount).toBe(240);
    expect(edited.totalAmount).toBe(240);
    expect(started.totalAmount).toBe(0);
    expect(started.chargeConsumedAmount).toBe(240);
    expect(removed.sponsors.find((record) => record.id === sponsorId)?.hiddenFromTodayAt).toEqual(expect.any(Number));
    expect(removed.programQueue).toEqual([]);
    expect(bulkRemoved.programQueue).toEqual([]);
    expect(realtimeHub.updates.map((update) => update.roomSlug)).toEqual([
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "alpha"
    ]);
  });
});
