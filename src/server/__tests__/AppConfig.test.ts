import { describe, expect, it } from "vitest";
import { AppConfig } from "../config/AppConfig";

describe("AppConfig", () => {
  it("uses deploy-friendly environment overrides with local defaults", () => {
    const config = AppConfig.fromEnv(
      {
        PORT: "4555",
        DATA_DIR: "runtime-data",
        DATABASE_PATH: "runtime-data/app.sqlite",
        DEFAULT_ROOM_SLUG: "main-room",
        NODE_ENV: "production"
      },
      "/srv/show-app"
    );

    expect(config.port).toBe(4555);
    expect(config.dataDirectory).toContain("runtime-data");
    expect(config.databasePath).toContain("app.sqlite");
    expect(config.defaultRoomSlug).toBe("main-room");
    expect(config.isProduction).toBe(true);
  });

  it("falls back to stable local development values", () => {
    const config = AppConfig.fromEnv({}, "/srv/show-app");

    expect(config.port).toBe(3000);
    expect(config.dataDirectory).toContain("data");
    expect(config.databasePath).toContain("app.sqlite");
    expect(config.defaultRoomSlug).toBe("default");
    expect(config.isProduction).toBe(false);
  });

  it("normalizes the default room slug from deployment environment values", () => {
    expect(AppConfig.fromEnv({ DEFAULT_ROOM_SLUG: "Main-Room" }, "/srv/show-app").defaultRoomSlug).toBe("main-room");
    expect(AppConfig.fromEnv({ DEFAULT_ROOM_SLUG: "../bad" }, "/srv/show-app").defaultRoomSlug).toBe("default");
  });
});
