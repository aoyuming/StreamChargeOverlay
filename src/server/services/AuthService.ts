import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthRole, AuthSession } from "../../shared/types";

export interface AuthConfig {
  adminPassword: string;
  sessionSecret: string;
  viewerPassword: string;
}

const COOKIE_NAME = "adminSession";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

type SignedSessionPayload = AuthSession & {
  createdAt: number;
};

export class AuthService {
  public constructor(
    private readonly config: AuthConfig,
    private readonly disabled = false
  ) {}

  public static disabled(): AuthService {
    return new AuthService({
      adminPassword: "",
      sessionSecret: "disabled",
      viewerPassword: ""
    }, true);
  }

  public login(password: string, roomSlug?: string): AuthSession | null {
    const adminSession = this.loginAdmin(password);
    if (adminSession) {
      return adminSession;
    }

    return this.loginViewer(password, roomSlug);
  }

  public loginAdmin(password: string): AuthSession | null {
    if (this.matches(password, this.config.adminPassword)) {
      return { role: "admin" };
    }

    return null;
  }

  public loginViewer(password: string, roomSlug?: string): AuthSession | null {
    if (this.matches(password, this.config.viewerPassword)) {
      return roomSlug ? { role: "viewer", roomSlug } : { role: "viewer" };
    }

    return null;
  }

  public createSessionCookie(session: AuthSession): string {
    const payload = Buffer.from(JSON.stringify({ ...session, createdAt: Date.now() }), "utf8").toString("base64url");
    const signature = this.sign(payload);
    return `${COOKIE_NAME}=${encodeURIComponent(`${payload}.${signature}`)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`;
  }

  public createClearCookie(): string {
    return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  }

  public sessionFromCookie(cookieHeader: string | undefined): AuthSession | null {
    if (this.disabled) {
      return { role: "admin" };
    }

    const token = this.cookieValue(cookieHeader);
    if (!token) {
      return null;
    }

    const session = this.sessionFromSignedJsonToken(token);
    return session ?? this.sessionFromLegacyToken(token);
  }

  public hasRole(cookieHeader: string | undefined, minimumRole: AuthRole, roomSlug?: string): boolean {
    if (this.disabled) {
      return true;
    }

    const session = this.sessionFromCookie(cookieHeader);
    if (!session) {
      return false;
    }

    if (session.role === "admin") {
      return true;
    }

    if (minimumRole === "admin") {
      return false;
    }

    return roomSlug ? session.roomSlug === roomSlug : true;
  }

  private cookieValue(cookieHeader: string | undefined): string | null {
    const cookies = cookieHeader?.split(";").map((cookie) => cookie.trim()) ?? [];
    const cookie = cookies.find((item) => item.startsWith(`${COOKIE_NAME}=`));
    return cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : null;
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.config.sessionSecret).update(payload).digest("base64url");
  }

  private sessionFromSignedJsonToken(token: string): AuthSession | null {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return null;
    }

    const [payload, signature] = parts;
    if (!this.matches(signature, this.sign(payload))) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SignedSessionPayload>;
      if (parsed.role !== "viewer" && parsed.role !== "admin") {
        return null;
      }

      const createdAt = Number(parsed.createdAt);
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > SESSION_MAX_AGE_MS) {
        return null;
      }

      const roomSlug = typeof parsed.roomSlug === "string" && parsed.roomSlug ? parsed.roomSlug : undefined;
      return roomSlug ? { role: parsed.role, roomSlug } : { role: parsed.role };
    } catch {
      return null;
    }
  }

  private sessionFromLegacyToken(token: string): AuthSession | null {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [role, createdAtText, signature] = parts;
    if (role !== "viewer" && role !== "admin") {
      return null;
    }

    const createdAt = Number(createdAtText);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > SESSION_MAX_AGE_MS) {
      return null;
    }

    const payload = `${role}.${createdAtText}`;
    if (!this.matches(signature, this.sign(payload))) {
      return null;
    }

    return { role };
  }

  private matches(left: string, right: string): boolean {
    if (!left || !right) {
      return false;
    }

    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
