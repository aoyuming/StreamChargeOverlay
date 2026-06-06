import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateRoomRequest, DerivedAppState, RoomInfo, SponsorRecord, StateRepository } from "../../shared/types";
import { ApiController } from "../controllers/ApiController";
import { AuthService } from "../services/AuthService";
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

class FakeAvatarStorage {
  public readonly saved: Array<{ roomSlug: string; sponsorId: string; dataUrl: string }> = [];
  public readonly cleared: string[] = [];

  public async saveAvatar(roomSlug: string, sponsorId: string, dataUrl: string): Promise<string> {
    this.saved.push({ roomSlug, sponsorId, dataUrl });
    return `/avatars/${roomSlug}/${sponsorId}.webp`;
  }

  public async clearAvatar(avatarUrl: string): Promise<void> {
    this.cleared.push(avatarUrl);
  }
}

class FakeRoomCatalog {
  private readonly viewerPasswords = new Map([
    ["alpha", "alpha-viewer"],
    ["beta", "beta-viewer"]
  ]);

  public listRooms(): RoomInfo[] {
    return [
      { slug: "alpha", name: "Alpha", createdAt: 1 },
      { slug: "beta", name: "Beta", createdAt: 2 }
    ];
  }

  public createRoom(_request: CreateRoomRequest): RoomInfo {
    return { slug: "gamma", name: "Gamma", createdAt: 3 };
  }

  public deleteRoom(_slug: string): RoomInfo[] {
    return this.listRooms();
  }

  public matchesViewerPassword(roomSlug: string, password: string): boolean {
    return this.viewerPasswords.get(roomSlug) === password;
  }

  public updateViewerPassword(roomSlug: string, password: string): void {
    this.viewerPasswords.set(roomSlug, password);
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
    const restored = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/add-to-today`, {
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
    expect(restored.sponsors.find((record) => record.id === sponsorId)?.hiddenFromTodayAt).toBeUndefined();
    expect(restored.programQueue.map((record) => record.id)).toEqual([sponsorId]);
    expect(bulkRemoved.programQueue).toEqual([]);
    expect(realtimeHub.updates.map((update) => update.roomSlug)).toEqual([
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "alpha",
      "alpha"
    ]);
  });

  it("accepts new sponsor avatars and exposes an admin-only avatar update route", async () => {
    const app = express();
    const avatarStorage = new FakeAvatarStorage();
    app.use(express.json());
    new (ApiController as any)(
      new MemoryRoomRepositoryFactory(),
      new FakeRealtimeHub(),
      new FakeSpeechService(),
      "default",
      new AuthService({
        adminPassword: "admin-password",
        sessionSecret: "test-secret",
        viewerPassword: "viewer-password"
      }),
      null,
      avatarStorage
    ).register(app);
    const running = await listen(app);
    server = running.server;

    const viewerLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "viewer-password", roomSlug: "alpha" })
    });
    const viewerCookie = viewerLogin.headers.get("set-cookie") ?? "";
    const added = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({
        bossName: "avatar boss",
        amount: 300,
        programName: "startup",
        avatarDataUrl: "data:image/webp;base64,first"
      })
    })).json()) as DerivedAppState;
    const sponsorId = added.sponsors[0]?.id ?? "";

    const viewerPatch = await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/avatar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({ avatarDataUrl: "data:image/png;base64,next" })
    });
    const adminLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "admin-password" })
    });
    const adminCookie = adminLogin.headers.get("set-cookie") ?? "";
    const patched = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/avatar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ avatarDataUrl: "data:image/png;base64,next" })
    })).json()) as DerivedAppState;
    const cleared = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/avatar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ avatarDataUrl: null })
    })).json()) as DerivedAppState;

    expect(added.sponsors[0]?.avatarUrl).toBe(`/avatars/alpha/${sponsorId}.webp`);
    expect(viewerPatch.status).toBe(403);
    expect(patched.sponsors[0]?.avatarUrl).toBe(`/avatars/alpha/${sponsorId}.webp`);
    expect(cleared.sponsors[0]?.avatarUrl).toBeUndefined();
    expect(avatarStorage.saved.map((item) => item.dataUrl)).toEqual([
      "data:image/webp;base64,first",
      "data:image/png;base64,next"
    ]);
    expect(avatarStorage.cleared).toContain(`/avatars/alpha/${sponsorId}.webp`);
  });

  it("exposes recycle-bin records to admins and lets admins restore them", async () => {
    const app = express();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      new FakeRealtimeHub(),
      new FakeSpeechService(),
      "default",
      new AuthService({
        adminPassword: "admin-password",
        sessionSecret: "test-secret",
        viewerPassword: "viewer-password"
      })
    ).register(app);
    const running = await listen(app);
    server = running.server;

    const viewerLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "viewer-password", roomSlug: "alpha" })
    });
    const viewerCookie = viewerLogin.headers.get("set-cookie") ?? "";
    const adminLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "admin-password", roomSlug: "alpha" })
    });
    const adminCookie = adminLogin.headers.get("set-cookie") ?? "";
    const added = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({ bossName: "trash boss", amount: 220, programName: "trash program" })
    })).json()) as DerivedAppState;
    const sponsorId = added.sponsors[0]?.id ?? "";

    await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie }
    });
    const viewerTrashResponse = await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash`, {
      headers: { Cookie: viewerCookie }
    });
    await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/amount`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ amount: 330 })
    });
    const trash = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash`, {
      headers: { Cookie: adminCookie }
    })).json()) as SponsorRecord[];
    const restored = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/${sponsorId}/restore`, {
      method: "POST",
      headers: { Cookie: adminCookie }
    })).json()) as DerivedAppState;

    expect(viewerTrashResponse.status).toBe(403);
    expect(trash.map((record) => [record.id, record.amount, typeof record.deletedAt])).toEqual([[sponsorId, 330, "number"]]);
    expect(restored.sponsors.map((record) => [record.id, record.amount])).toEqual([[sponsorId, 330]]);
    expect(restored.restoredSponsorId).toBe(sponsorId);
  });

  it("lets admins bulk-delete active sponsors and permanently clean recycle-bin records", async () => {
    const app = express();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      new FakeRealtimeHub(),
      new FakeSpeechService(),
      "default",
      new AuthService({
        adminPassword: "admin-password",
        sessionSecret: "test-secret",
        viewerPassword: "viewer-password"
      })
    ).register(app);
    const running = await listen(app);
    server = running.server;

    const viewerLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "viewer-password", roomSlug: "alpha" })
    });
    const viewerCookie = viewerLogin.headers.get("set-cookie") ?? "";
    const adminLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "admin-password", roomSlug: "alpha" })
    });
    const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

    await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({ bossName: "trash boss a", amount: 220, programName: "trash program a" })
    });
    await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: viewerCookie },
      body: JSON.stringify({ bossName: "trash boss b", amount: 330, programName: "trash program b" })
    });

    const bulkDeleted = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "DELETE",
      headers: { Cookie: adminCookie }
    })).json()) as DerivedAppState;
    const trashAfterBulk = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash`, {
      headers: { Cookie: adminCookie }
    })).json()) as SponsorRecord[];
    const viewerClearResponse = await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash`, {
      method: "DELETE",
      headers: { Cookie: viewerCookie }
    });
    const firstTrashId = trashAfterBulk[0]?.id ?? "";
    await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash/${firstTrashId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie }
    });
    const trashAfterOnePermanentDelete = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash`, {
      headers: { Cookie: adminCookie }
    })).json()) as SponsorRecord[];
    const cleared = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash`, {
      method: "DELETE",
      headers: { Cookie: adminCookie }
    })).json()) as DerivedAppState;
    const trashAfterClear = (await (await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors/trash`, {
      headers: { Cookie: adminCookie }
    })).json()) as SponsorRecord[];

    expect(bulkDeleted.sponsors).toEqual([]);
    expect(trashAfterBulk).toHaveLength(2);
    expect(viewerClearResponse.status).toBe(403);
    expect(trashAfterOnePermanentDelete).toHaveLength(1);
    expect(cleared.sponsors).toEqual([]);
    expect(trashAfterClear).toEqual([]);
  });

  it("allows viewer sessions to update settings and start dianjiang without edit/delete permissions", async () => {
    const app = express();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      new FakeRealtimeHub(),
      new FakeSpeechService(),
      "default",
      new AuthService({
        adminPassword: "admin-password",
        sessionSecret: "test-secret",
        viewerPassword: "viewer-password"
      })
    ).register(app);
    const running = await listen(app);
    server = running.server;

    const loginResponse = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "viewer-password", roomSlug: "default" })
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const settingsResponse = await fetch(`${running.baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ targetAmount: 300, slogan: "viewer slogan" })
    });
    const added = (await (await fetch(`${running.baseUrl}/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ bossName: "viewer boss", amount: 300, programName: "startup", countsTowardCharge: true })
    })).json()) as DerivedAppState;
    const startedResponse = await fetch(`${running.baseUrl}/api/charge/start`, {
      method: "POST",
      headers: { Cookie: cookie }
    });
    const editResponse = await fetch(`${running.baseUrl}/api/sponsors/${added.sponsors[0]?.id ?? ""}/amount`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ amount: 100 })
    });
    const started = (await startedResponse.json()) as DerivedAppState;

    expect(settingsResponse.status).toBe(200);
    expect(startedResponse.status).toBe(200);
    expect(started.totalAmount).toBe(0);
    expect(started.chargeConsumedAmount).toBe(300);
    expect(editResponse.status).toBe(403);
  });

  it("binds viewer sessions to the room whose password was used", async () => {
    const app = express();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      new FakeRealtimeHub(),
      new FakeSpeechService(),
      "default",
      new AuthService({
        adminPassword: "admin-password",
        sessionSecret: "test-secret",
        viewerPassword: "legacy-viewer"
      }),
      new FakeRoomCatalog()
    ).register(app);
    const running = await listen(app);
    server = running.server;

    const loginResponse = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "alpha-viewer", roomSlug: "alpha" })
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const alphaResponse = await fetch(`${running.baseUrl}/rooms/alpha/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ bossName: "alpha boss", amount: 100, programName: "alpha program" })
    });
    const betaResponse = await fetch(`${running.baseUrl}/rooms/beta/api/sponsors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ bossName: "beta boss", amount: 100, programName: "beta program" })
    });
    const session = await (await fetch(`${running.baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie }
    })).json();

    expect(loginResponse.status).toBe(200);
    expect(alphaResponse.status).toBe(201);
    expect(betaResponse.status).toBe(403);
    expect(session).toEqual({ role: "viewer", roomSlug: "alpha" });
  });

  it("lets admin update one room viewer password without affecting other rooms", async () => {
    const app = express();
    app.use(express.json());
    new ApiController(
      new MemoryRoomRepositoryFactory(),
      new FakeRealtimeHub(),
      new FakeSpeechService(),
      "default",
      new AuthService({
        adminPassword: "admin-password",
        sessionSecret: "test-secret",
        viewerPassword: "legacy-viewer"
      }),
      new FakeRoomCatalog()
    ).register(app);
    const running = await listen(app);
    server = running.server;

    const adminLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "admin-password", roomSlug: "alpha" })
    });
    const adminCookie = adminLogin.headers.get("set-cookie") ?? "";

    const updateResponse = await fetch(`${running.baseUrl}/api/rooms/alpha/viewer-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ password: "new-alpha-viewer" })
    });
    const oldAlphaLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "alpha-viewer", roomSlug: "alpha" })
    });
    const newAlphaLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "new-alpha-viewer", roomSlug: "alpha" })
    });
    const betaLogin = await fetch(`${running.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "beta-viewer", roomSlug: "beta" })
    });

    expect(updateResponse.status).toBe(200);
    expect(oldAlphaLogin.status).toBe(401);
    expect(newAlphaLogin.status).toBe(200);
    expect(betaLogin.status).toBe(200);
  });
});
