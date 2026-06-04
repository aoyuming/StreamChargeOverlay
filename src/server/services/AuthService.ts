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

  public login(password: string): AuthSession | null {
    if (this.matches(password, this.config.adminPassword)) {
      return { role: "admin" };
    }

    if (this.matches(password, this.config.viewerPassword)) {
      return { role: "viewer" };
    }

    return null;
  }

  public createSessionCookie(session: AuthSession): string {
    const createdAt = Date.now();
    const payload = `${session.role}.${createdAt}`;
    const signature = this.sign(payload);
    return `${COOKIE_NAME}=${payload}.${signature}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`;
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

  public hasRole(cookieHeader: string | undefined, minimumRole: AuthRole): boolean {
    if (this.disabled) {
      return true;
    }

    const session = this.sessionFromCookie(cookieHeader);
    if (!session) {
      return false;
    }

    return minimumRole === "viewer" || session.role === "admin";
  }

  private cookieValue(cookieHeader: string | undefined): string | null {
    const cookies = cookieHeader?.split(";").map((cookie) => cookie.trim()) ?? [];
    const cookie = cookies.find((item) => item.startsWith(`${COOKIE_NAME}=`));
    return cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : null;
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.config.sessionSecret).update(payload).digest("base64url");
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
