import type { Express, Request, Response } from "express";
import { normalizeRoomSlug } from "../../shared/RoomSlug";
import type {
  AddSponsorRequest,
  ApiErrorResponse,
  DerivedAppState,
  SpeechAlert,
  SponsorRecord,
  UpdateSettingsRequest,
  UpdateTargetRequest
} from "../../shared/types";
import type { RoomStateRepositoryFactory } from "../repositories/RoomStateRepositoryFactory";
import { DonationService } from "../services/DonationService";

type AsyncRoute = (request: Request, response: Response) => Promise<void>;

export interface SponsorSpeechService {
  createSponsorSpeech(record: SponsorRecord): Promise<SpeechAlert | null>;
}

export interface RealtimeStateBroadcaster {
  broadcastState(roomSlug: string, state: DerivedAppState): void;
}

// Resolves room-scoped HTTP requests, delegates business rules to DonationService,
// and broadcasts updates only to clients watching the same room.
export class ApiController {
  public constructor(
    private readonly repositoryFactory: RoomStateRepositoryFactory,
    private readonly realtimeHub: RealtimeStateBroadcaster,
    private readonly speechService: SponsorSpeechService,
    private readonly defaultRoomSlug: string
  ) {}

  public register(app: Express): void {
    app.get("/api/state", this.wrap((request, response) => this.getState(request, response)));
    app.get("/rooms/:roomSlug/api/state", this.wrap((request, response) => this.getState(request, response)));

    app.post("/api/sponsors", this.wrap((request, response) => this.addSponsor(request, response)));
    app.post("/rooms/:roomSlug/api/sponsors", this.wrap((request, response) => this.addSponsor(request, response)));

    app.delete("/api/sponsors/:id", this.wrap((request, response) => this.deleteSponsor(request, response)));
    app.delete("/rooms/:roomSlug/api/sponsors/:id", this.wrap((request, response) => this.deleteSponsor(request, response)));

    app.put("/api/settings/target", this.wrap((request, response) => this.updateTargetAmount(request, response)));
    app.put("/rooms/:roomSlug/api/settings/target", this.wrap((request, response) => this.updateTargetAmount(request, response)));

    app.put("/api/settings", this.wrap((request, response) => this.updateSettings(request, response)));
    app.put("/rooms/:roomSlug/api/settings", this.wrap((request, response) => this.updateSettings(request, response)));
  }

  private async getState(request: Request, response: Response): Promise<void> {
    response.json(await (await this.serviceFor(request)).getState());
  }

  private async addSponsor(request: Request, response: Response): Promise<void> {
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
    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).deleteSponsor(String(request.params.id ?? ""));
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async updateTargetAmount(request: Request, response: Response): Promise<void> {
    const roomSlug = this.roomSlugFrom(request);
    const body = request.body as UpdateTargetRequest;
    const state = await (await this.serviceFor(request)).updateTargetAmount(body.targetAmount);
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async updateSettings(request: Request, response: Response): Promise<void> {
    const roomSlug = this.roomSlugFrom(request);
    const state = await (await this.serviceFor(request)).updateSettings(request.body as UpdateSettingsRequest);
    this.realtimeHub.broadcastState(roomSlug, state);
    response.json(state);
  }

  private async serviceFor(request: Request): Promise<DonationService> {
    return new DonationService(await this.repositoryFactory.getRepository(this.roomSlugFrom(request)));
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
