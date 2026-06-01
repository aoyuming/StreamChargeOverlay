import type { AddSponsorRequest, ApiErrorResponse, DerivedAppState, UpdateSettingsRequest } from "../../shared/types";

// 统一封装 fetch，页面层不需要重复处理 JSON、错误码和接口路径。
export class ApiClient {
  public async getState(): Promise<DerivedAppState> {
    return this.request<DerivedAppState>("/api/state");
  }

  public async addSponsor(request: AddSponsorRequest): Promise<DerivedAppState> {
    return this.request<DerivedAppState>("/api/sponsors", {
      method: "POST",
      body: JSON.stringify(request)
    });
  }

  public async deleteSponsor(id: string): Promise<DerivedAppState> {
    return this.request<DerivedAppState>(`/api/sponsors/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  }

  public async updateTargetAmount(targetAmount: number): Promise<DerivedAppState> {
    return this.request<DerivedAppState>("/api/settings/target", {
      method: "PUT",
      body: JSON.stringify({ targetAmount })
    });
  }

  public async updateSettings(request: UpdateSettingsRequest): Promise<DerivedAppState> {
    return this.request<DerivedAppState>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(request)
    });
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
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
