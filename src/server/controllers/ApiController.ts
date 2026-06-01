import type { Express, Request, Response } from "express";
import type { AddSponsorRequest, ApiErrorResponse, UpdateSettingsRequest, UpdateTargetRequest } from "../../shared/types";
import { DonationService } from "../services/DonationService";
import { RealtimeHub } from "../services/RealtimeHub";

type AsyncRoute = (request: Request, response: Response) => Promise<void>;

// HTTP 控制器负责解析请求、返回 JSON，并在写操作后推送最新状态。
export class ApiController {
  public constructor(
    private readonly donationService: DonationService,
    private readonly realtimeHub: RealtimeHub
  ) {}

  public register(app: Express): void {
    app.get("/api/state", this.wrap(async (_request, response) => {
      response.json(await this.donationService.getState());
    }));

    app.post("/api/sponsors", this.wrap(async (request, response) => {
      const state = await this.donationService.addSponsor(request.body as AddSponsorRequest);
      this.realtimeHub.broadcastState(state);
      response.status(201).json(state);
    }));

    app.delete("/api/sponsors/:id", this.wrap(async (request, response) => {
      const state = await this.donationService.deleteSponsor(String(request.params.id ?? ""));
      this.realtimeHub.broadcastState(state);
      response.json(state);
    }));

    app.put("/api/settings/target", this.wrap(async (request, response) => {
      const body = request.body as UpdateTargetRequest;
      const state = await this.donationService.updateTargetAmount(body.targetAmount);
      this.realtimeHub.broadcastState(state);
      response.json(state);
    }));

    app.put("/api/settings", this.wrap(async (request, response) => {
      const state = await this.donationService.updateSettings(request.body as UpdateSettingsRequest);
      this.realtimeHub.broadcastState(state);
      response.json(state);
    }));
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
