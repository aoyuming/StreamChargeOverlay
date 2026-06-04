import { resolve } from "node:path";
import { normalizeRoomSlug } from "../../shared/RoomSlug";

type AppEnv = Partial<
  Record<
    | "PORT"
    | "DATA_DIR"
    | "DATABASE_PATH"
    | "DEFAULT_ROOM_SLUG"
    | "NODE_ENV"
    | "ADMIN_VIEWER_PASSWORD"
    | "ADMIN_SUPER_PASSWORD"
    | "SESSION_SECRET",
    string
  >
>;

const DEFAULT_PORT = 3000;
const DEFAULT_DATA_DIR = "data";
const DEFAULT_DATABASE_FILE = "app.sqlite";
const DEFAULT_ROOM_SLUG = "default";
const DEFAULT_VIEWER_PASSWORD = "add1234";
const DEFAULT_SUPER_PASSWORD = "super1234";
const DEFAULT_SESSION_SECRET = "local-session-secret";

// Centralizes values that differ between local development and deployment.
// Production setup should change environment variables, not application code.
export class AppConfig {
  public constructor(
    public readonly port: number,
    public readonly dataDirectory: string,
    public readonly databasePath: string,
    public readonly defaultRoomSlug: string,
    public readonly isProduction: boolean,
    public readonly viewerPassword: string,
    public readonly adminPassword: string,
    public readonly sessionSecret: string
  ) {}

  public static fromEnv(env: AppEnv = process.env, cwd = process.cwd()): AppConfig {
    const dataDirectory = resolve(cwd, env.DATA_DIR?.trim() || DEFAULT_DATA_DIR);
    const databasePath = resolve(cwd, env.DATABASE_PATH?.trim() || resolve(dataDirectory, DEFAULT_DATABASE_FILE));

    return new AppConfig(
      this.parsePort(env.PORT),
      dataDirectory,
      databasePath,
      normalizeRoomSlug(env.DEFAULT_ROOM_SLUG, DEFAULT_ROOM_SLUG),
      env.NODE_ENV === "production",
      env.ADMIN_VIEWER_PASSWORD?.trim() || DEFAULT_VIEWER_PASSWORD,
      env.ADMIN_SUPER_PASSWORD?.trim() || DEFAULT_SUPER_PASSWORD,
      env.SESSION_SECRET?.trim() || DEFAULT_SESSION_SECRET
    );
  }

  private static parsePort(value: string | undefined): number {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
  }
}
