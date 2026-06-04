import type {
  AddSponsorRequest,
  ApiErrorResponse,
  AuthSession,
  CreateRoomRequest,
  DerivedAppState,
  RoomInfo,
  UpdateSponsorAvatarRequest,
  UpdateSettingsRequest
} from "../../shared/types";
import { RoomContext } from "./RoomContext";

// Centralizes HTTP paths and JSON error handling for display/admin pages.
// Room-aware paths keep deployment links stable while allowing isolated rooms.
export class ApiClient {
  public constructor(private readonly roomContext = new RoomContext("default")) {}

  public async getState(): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath("/state"));
  }

  public async getRooms(): Promise<RoomInfo[]> {
    return this.request<RoomInfo[]>("/api/rooms");
  }

  public async createRoom(name: string): Promise<RoomInfo> {
    const request: CreateRoomRequest = { name };
    return this.request<RoomInfo>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  public async deleteRoom(slug: string): Promise<RoomInfo[]> {
    return this.request<RoomInfo[]>(`/api/rooms/${encodeURIComponent(slug)}`, {
      method: "DELETE"
    });
  }

  public async getAuthSession(): Promise<AuthSession | null> {
    try {
      return await this.request<AuthSession>("/api/auth/me");
    } catch {
      return null;
    }
  }

  public async login(password: string): Promise<AuthSession> {
    return this.request<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });
  }

  public async logout(): Promise<void> {
    await this.request<{ ok: true }>("/api/auth/logout", {
      method: "POST"
    });
  }

  public async addSponsor(request: AddSponsorRequest): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath("/sponsors"), {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  public async deleteSponsor(id: string): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath(`/sponsors/${encodeURIComponent(id)}`), {
      method: "DELETE"
    });
  }

  public async startDianjiang(): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath("/charge/start"), {
      method: "POST"
    });
  }

  public async updateSponsorAmount(id: string, amount: number): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath(`/sponsors/${encodeURIComponent(id)}/amount`), {
      method: "PATCH",
      body: JSON.stringify({ amount })
    });
  }

  public async updateSponsorAvatar(id: string, avatarDataUrl: string | null): Promise<DerivedAppState> {
    const request: UpdateSponsorAvatarRequest = { avatarDataUrl };
    return this.request<DerivedAppState>(this.apiPath(`/sponsors/${encodeURIComponent(id)}/avatar`), {
      method: "PATCH",
      body: JSON.stringify(request)
    });
  }

  public async removeSponsorFromToday(id: string): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath(`/sponsors/${encodeURIComponent(id)}/remove-from-today`), {
      method: "POST"
    });
  }

  public async addSponsorToToday(id: string): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath(`/sponsors/${encodeURIComponent(id)}/add-to-today`), {
      method: "POST"
    });
  }

  public async removeTodaySponsors(): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath("/sponsors/remove-from-today"), {
      method: "POST"
    });
  }

  public async updateTargetAmount(targetAmount: number): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath("/settings/target"), {
      method: "PUT",
      body: JSON.stringify({ targetAmount })
    });
  }

  public async updateSettings(request: UpdateSettingsRequest): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(this.apiPath("/settings"), {
      method: "PUT",
      body: JSON.stringify(request)
    });
  }

  private apiPath(path: string): string {
    if (this.roomContext.slug === "default") {
      return `/api${path}`;
    }

    return `/rooms/${encodeURIComponent(this.roomContext.slug)}/api${path}`;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...init.headers
      }
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as Partial<ApiErrorResponse>;
      throw new Error(errorBody.error ?? `请求失败: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
