import { describe, expect, it } from "vitest";
import { AuthService } from "../services/AuthService";

describe("AuthService", () => {
  it("maps viewer and admin passwords to signed cookie sessions", () => {
    const service = new AuthService({
      adminPassword: "super-secret",
      sessionSecret: "session-secret",
      viewerPassword: "add-secret"
    });

    const viewer = service.login("add-secret");
    const admin = service.login("super-secret");
    const cookie = service.createSessionCookie(admin ?? { role: "admin" });

    expect(viewer?.role).toBe("viewer");
    expect(admin?.role).toBe("admin");
    expect(service.login("wrong")).toBeNull();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(service.sessionFromCookie(cookie)?.role).toBe("admin");
  });
});
