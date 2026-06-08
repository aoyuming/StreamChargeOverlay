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

  it("loads Doubao TTS 2.0 settings with safe defaults", () => {
    const config = AppConfig.fromEnv(
      {
        DOUBAO_TTS_ENABLED: "true",
        DOUBAO_TTS_API_KEY: "api-key",
        DOUBAO_TTS_APP_ID: "app-id",
        DOUBAO_TTS_ACCESS_TOKEN: "secret-token",
        DOUBAO_TTS_RESOURCE_ID: "seed-tts-2.0",
        DOUBAO_TTS_VOICE_TYPE: "custom-voice",
        DOUBAO_TTS_TIMEOUT_MS: "4500"
      },
      "/srv/show-app"
    );

    expect(config.doubaoTts).toEqual({
      enabled: true,
      apiKey: "api-key",
      appId: "app-id",
      accessToken: "secret-token",
      resourceId: "seed-tts-2.0",
      voiceType: "custom-voice",
      timeoutMs: 4500
    });
  });

  it("keeps Doubao disabled unless credentials are configured", () => {
    const config = AppConfig.fromEnv({}, "/srv/show-app");

    expect(config.doubaoTts).toEqual({
      enabled: false,
      apiKey: "",
      appId: "",
      accessToken: "",
      resourceId: "seed-tts-2.0",
      voiceType: "zh_female_jiaochuannv_uranus_bigtts",
      timeoutMs: 7000
    });
  });
});
