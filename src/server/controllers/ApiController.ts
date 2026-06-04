import type { Express, Request, Response } from "express";
import { normalizeRoomSlug } from "../../shared/RoomSlug";
import type {
  AddSponsorRequest,
  ApiErrorResponse,
  AuthRole,
  CreateRoomRequest,
  DerivedAppState,
  LoginRequest,
  RoomInfo,
  SpeechAlert,
  SponsorRecord,
  UpdateRoomViewerPasswordRequest,
  UpdateSponsorAmountRequest,
  UpdateSponsorAvatarRequest,
  UpdateSettingsRequest,
  UpdateTargetRequest
} from "../../shared/types";
import type { RoomStateRepositoryFactory } from "../repositories/RoomStateRepositoryFactory";
import { AuthService } from "../services/AuthService";
import type { SponsorAvatarStorage } from "../services/AvatarService";
import { DonationService } from "../services/DonationService";

type AsyncRoute = (request: Request, response: Response) => Promise<void>;

export interface SponsorSpeechService {
  createSponsorSpeech(record: SponsorRecord): Promise<SpeechAlert | null>;
}

export interface RealtimeStateBroadcaster {
  broadcastState(roomSlug: string, state: DerivedAppState): void;
}

export interface RoomCatalog {
  listRooms(): RoomInfo[];
  createRoom(request: CreateRoomRequest): RoomInfo;
  deleteRoom(slug: string): RoomInfo[];
  matchesViewerPassword(roomSlug: string, password: string): boolean;
  updateViewerPassword(roomSlug: string, password: string): void;
}

// Resolves room-scoped HTTP requests, delegates business rules to DonationService,
// and broadcasts updates only to clients watching the same room.
export class ApiController {
  public constructor(
    private readonly repositoryFactory: RoomStateRepositoryFactory,
    private readonly realtimeHub: RealtimeStateBroadcaster,
    private readonly speechService: SponsorSpeechService,
    private readonly defaultRoomSlug: string,
    private readonly authService = AuthService.disabled(),
    private readonly roomCatalog: RoomCatalog | null = null,
    private readonly avatarStorage?: SponsorAvatarStorage
  ) {}

  public register(app: Express): void {
    app.get("/api/rooms", this.wrap((request, response) => this.listRooms(request, response)));
    app.post("/api/rooms", this.wrap((request, response) => this.createRoom(request, response)));
    app.delete("/api/rooms/:roomSlug", this.wrap((request, response) => this.deleteRoom(request, response)));
    app.patch("/api/rooms/:roomSlug/viewer-password", this.wrap((request, response) => this.updateRoomViewerPassword(request, response)));

    app.post("/api/auth/login", this.wrap((request, response) => this.login(request, response)));
    app.get("/api/auth/me", this.wrap((request, response) => this.getAuthSession(request, response)));
    app.post("/api/auth/logout", this.wrap((request, response) => this.logout(request, response)));

    app.get("/api/state", this.wrap((request, response) => this.getState(request, response)));
    app.get("/rooms/:roomSlug/api/state", this.wrap((request, response) => this.getState(request, response)));

    app.post("/api/sponsors", this.wrap((request, response) => this.addSponsor(request, response)));
    app.post("/rooms/:roomSlug/api/sponsors", this.wrap((request, response) => this.addSponsor(request, response)));

    app.get("/api/sponsors/trash", this.wrap((request, response) => this.listTrashSponsors(request, response)));
    app.get("/rooms/:roomSlug/api/sponsors/trash", this.wrap((request, response) => this.listTrashSponsors(request, response)));

    app.delete("/api/sponsors/:id", this.wrap((request, response) => this.deleteSponsor(request, response)));
    app.delete("/rooms/:roomSlug/api/sponsors/:id", this.wrap((request, response) => this.deleteSponsor(request, response)));

    app.post("/api/sponsors/:id/restore", this.wrap((request, response) => this.restoreSponsor(request, response)));
    app.post("/rooms/:roomSlug/api/sponsors/:id/restore", this.wrap((request, response) => this.restoreSponsor(request, response)));

    app.patch("/api/sponsors/:id/amount", this.wrap((request, response) => this.updateSponsorAmount(request, response)));
    app.patch("/rooms/:roomSlug/api/sponsors/:id/amount", this.wrap((request, response) => this.updateSponsorAmount(request, response)));

    app.patch("/api/sponsors/:id/avatar", this.wrap((request, response) => this.updateSponsorAvatar(request, response)));
    app.patch("/rooms/:roomSlug/api/sponsors/:id/avatar", this.wrap((request, response) => this.updateSponsorAvatar(request, response)));

    app.post("/api/sponsors/:id/remove-from-today", this.wrap((request, response) => this.removeSponsorFromToday(request, response)));
    app.post("/rooms/:roomSlug/api/sponsors/:id/remove-from-today", this.wrap((request, response) => this.removeSponsorFromToday(request, response)));

    app.post("/api/sponsors/:id/add-to-today", this.wrap((request, response) => this.addSponsorToToday(request, response)));
    app.post("/rooms/:roomSlug/api/sponsors/:id/add-to-today", this.wrap((request, response) => this.addSponsorToToday(request, response)));

    app.post("/api/sponsors/remove-from-today", this.wrap((request, response) => this.removeTodaySponsors(request, response)));
    app.post("/rooms/:roomSlug/api/sponsors/remove-from-today", this.wrap((request, response) => this.removeTodaySponsors(request, response)));

    app.post("/api/charge/start", this.wrap((request, response) => this.startDianjiang(request, response)));
    app.post("/rooms/:roomSlug/api/charge/start", this.wrap((request, response) => this.startDianjiang(request, response)));

    app.put("/api/settings/target", this.wrap((request, response) => this.updateTargetAmount(request, response)));
    app.put("/rooms/:roomSlug/api/settings/target", this.wrap((request, response) => this.updateTargetAmount(request, response)));

    app.put("/api/settings", this.wrap((request, response) => this.updateSettings(request, response)));
    app.put("/rooms/:roomSlug/api/settings", this.wrap((request, response) => this.updateSettings(request, response)));
  }

  private async listRooms(_request: Request, response: Response): Promise<void> {
    response.json(this.roomCatalog?.listRooms() ?? []);
  }

  private async createRoom(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    if (!this.roomCatalog) {
      throw new Error("房间管理服务未启用");
    }

    response.status(201).json(this.roomCatalog.createRoom(request.body as CreateRoomRequest));
  }

  private async deleteRoom(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    if (!this.roomCatalog) {
      throw new Error("房间管理服务未启用");
    }

    response.json(this.roomCatalog.deleteRoom(String(request.params.roomSlug ?? "")));
  }

  private async updateRoomViewerPassword(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    if (!this.roomCatalog) {
      throw new Error("房间管理服务未启用");
    }

    const body = request.body as UpdateRoomViewerPasswordRequest;
    this.roomCatalog.updateViewerPassword(String(request.params.roomSlug ?? ""), String(body.password ?? ""));
    response.json({ ok: true });
  }

  private async login(request: Request, response: Response): Promise<void> {
    const body = request.body as LoginRequest;
    const password = String(body.password ?? "");
    const roomSlug = normalizeRoomSlug(body.roomSlug, this.defaultRoomSlug);
    const session =
      this.authService.loginAdmin(password) ??
      (this.roomCatalog
        ? this.roomCatalog.matchesViewerPassword(roomSlug, password)
          ? { role: "viewer" as const, roomSlug }
          : null
        : this.authService.loginViewer(password, roomSlug));
    if (!session) {
      response.status(401).json({ error: "密码不正确" });
      return;
    }

    response.setHeader("Set-Cookie", this.authService.createSessionCookie(session));
    response.json(session);
  }

  private async getAuthSession(request: Request, response: Response): Promise<void> {
    const session = this.authService.sessionFromCookie(request.headers.cookie);
    if (!session) {
      response.status(401).json({ error: "请先登录后台" });
      return;
    }

    response.json(session);
  }

  private async logout(_request: Request, response: Response): Promise<void> {
    response.setHeader("Set-Cookie", this.authService.createClearCookie());
    response.json({ ok: true });
  }

  private async getState(request: Request, response: Response): Promise<void> {
    response.json(await (await this.serviceFor(request)).getState());
  }

  private async addSponsor(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "viewer")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).addSponsor(request.body as AddSponsorRequest);
    const newRecord = state.sponsors.reduce((latest, record) => {
      return record.createdAt > latest.createdAt ? record : latest;
    }, state.sponsors[0]);
    const speechAlert = newRecord ? await this.speechService.createSponsorSpeech(newRecord) : null;
    const stateWithSpeech = speechAlert ? { ...state, speechAlert } : state;
    this.realtimeHub.broadcastState(roomSlug, stateWithSpeech);
    response.status(201).json(stateWithSpeech);
  }

  private async deleteSponsor(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).deleteSponsor(String(request.params.id ?? ""));
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async listTrashSponsors(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    response.json(await (await this.serviceFor(request)).listTrashSponsors());
  }

  private async restoreSponsor(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).restoreSponsor(String(request.params.id ?? ""));
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async updateSponsorAmount(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const body = request.body as UpdateSponsorAmountRequest;
    const state = await (await this.serviceFor(request)).updateSponsorAmount(String(request.params.id ?? ""), body.amount);
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async updateSponsorAvatar(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const body = request.body as UpdateSponsorAvatarRequest;
    const state = await (await this.serviceFor(request)).updateSponsorAvatar(
      String(request.params.id ?? ""),
      body.avatarDataUrl
    );
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async removeSponsorFromToday(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).removeSponsorFromToday(String(request.params.id ?? ""));
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async addSponsorToToday(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).addSponsorToToday(String(request.params.id ?? ""));
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async removeTodaySponsors(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "admin")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).removeTodaySponsors();
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async startDianjiang(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "viewer")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).startDianjiang();
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async updateTargetAmount(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "viewer")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const body = request.body as UpdateTargetRequest;
    const state = await (await this.serviceFor(request)).updateTargetAmount(body.targetAmount);
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async updateSettings(request: Request, response: Response): Promise<void> {
    if (!this.requireRole(request, response, "viewer")) {
      return;
    }

    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).updateSettings(request.body as UpdateSettingsRequest);
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async serviceFor(request: Request): Promise<DonationService> {
    const roomSlug = this.roomSlugFrom(request);
    return new DonationService(await this.repositoryFactory.getRepository(roomSlug), {
      avatarStorage: this.avatarStorage,
      roomSlug
    });
  }

  private requireRole(request: Request, response: Response, role: AuthRole): boolean {
    if (this.authService.hasRole(request.headers.cookie, role, this.roomSlugFrom(request))) {
      return true;
    }

    const session = this.authService.sessionFromCookie(request.headers.cookie);
    response.status(session ? 403 : 401).json({ error: session ? "权限不足" : "请先登录后台" });
    return false;
  }

  private roomSlugFrom(request: Request): string {
    return normalizeRoomSlug(String(request.params.roomSlug ?? ""), this.defaultRoomSlug);
  }

  private wrap(route: AsyncRoute): AsyncRoute {
    return async (request, response) => {
      try {
        await route(request, response);
      } catch (error) {
        const body: ApiErrorResponse = {
          error: error instanceof Error ? error.message : "服务器处理请求失败"
        };
        response.status(400).json(body);
      }
    };
  }
}
