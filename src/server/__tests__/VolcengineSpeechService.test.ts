import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SponsorRecord } from "../../shared/types";
import { VolcengineSpeechService } from "../services/VolcengineSpeechService";

const sponsor = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
  id: "doubao-1",
  bossName: "Doubao Boss",
  amount: 188,
  programName: "Doubao Program",
  note: "Note",
  countsTowardCharge: true,
  createdAt: 1,
  ...overrides
});

describe("VolcengineSpeechService", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  const createTempSpeechDirectory = async () => {
    const directory = await mkdtemp(join(tmpdir(), "stream-charge-doubao-speech-"));
    tempDirs.push(directory);
    return directory;
  };

  const config = {
    enabled: true,
    apiKey: "api-key",
    appId: "app-id",
    accessToken: "secret-token",
    resourceId: "seed-tts-2.0",
    voiceType: "zh_female_jiaochuannv_uranus_bigtts",
    timeoutMs: 7000
  };

  it("generates a speech file from Doubao TTS 2.0 chunk data", async () => {
    const speechDirectory = await createTempSpeechDirectory();
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init: init ?? {} });
      return new Response(
        [
          JSON.stringify({ code: 0, data: Buffer.from("hello ").toString("base64") }),
          "\n",
          JSON.stringify({ code: 0, data: Buffer.from("world").toString("base64") })
        ].join(""),
        { status: 200 }
      );
    });
    const entries: Array<{ module: string; message: string; details?: Record<string, unknown> }> = [];
    const logger = {
      info(module: string, message: string, details?: Record<string, unknown>) {
        entries.push({ module, message, details });
      },
      warn() {},
      error() {}
    };

    const service = new VolcengineSpeechService({
      speechDirectory,
      config,
      fetchImpl: fetchImpl as never,
      logger
    });

    const alert = await service.createSponsorSpeech(sponsor({ bossName: "豆包老板" }));

    expect(alert).toMatchObject({
      id: "doubao-1",
      url: "/speech/doubao-1-doubao.mp3",
      text: expect.stringContaining("豆包大哥")
    });
    expect(readFileSync(join(speechDirectory, "doubao-1-doubao.mp3")).toString()).toBe("hello world");
    expect(fetchCalls[0]?.url).toBe("https://openspeech.bytedance.com/api/v3/tts/unidirectional");
    expect(fetchCalls[0]?.init.headers).toEqual(
      expect.objectContaining({
        "X-Api-App-Key": "aGjiRDfUWi",
        "X-Api-Key": "api-key",
        "X-Api-Resource-Id": "seed-tts-2.0"
      })
    );
    expect(JSON.parse(String(fetchCalls[0]?.init.body))).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ uid: "stream-charge-overlay" }),
        req_params: expect.objectContaining({
          speaker: "zh_female_jiaochuannv_uranus_bigtts",
          text: expect.stringContaining("豆包大哥"),
          additions: JSON.stringify({ explicit_language: "zh" }),
          audio_params: expect.objectContaining({
            format: "mp3",
            sample_rate: 24000
          })
        })
      })
    );
    expect(entries).toContainEqual({
      module: "speech",
      message: "doubao speech ready",
      details: expect.objectContaining({
        sponsorId: "doubao-1",
        bossName: "豆包老板",
        voiceType: "zh_female_jiaochuannv_uranus_bigtts"
      })
    });
    expect(JSON.stringify(entries)).not.toContain("secret-token");
    expect(JSON.stringify(entries)).not.toContain("api-key");
  });

  it("accepts the Doubao OK terminal frame after audio chunks", async () => {
    const speechDirectory = await createTempSpeechDirectory();
    const service = new VolcengineSpeechService({
      speechDirectory,
      config,
      fetchImpl: vi.fn(async () => {
        return new Response(
          [
            JSON.stringify({ code: 0, data: Buffer.from("doubao audio").toString("base64") }),
            "\n",
            JSON.stringify({ code: 20000000, message: "OK" })
          ].join(""),
          { status: 200 }
        );
      }) as never
    });

    const alert = await service.createSponsorSpeech(sponsor());

    expect(alert?.url).toBe("/speech/doubao-1-doubao.mp3");
    expect(readFileSync(join(speechDirectory, "doubao-1-doubao.mp3")).toString()).toBe("doubao audio");
  });

  it("returns null and logs a warning when Doubao is not configured or fails", async () => {
    const speechDirectory = await createTempSpeechDirectory();
    const entries: Array<{ module: string; message: string; details?: Record<string, unknown> }> = [];
    const logger = {
      info() {},
      warn(module: string, message: string, details?: Record<string, unknown>) {
        entries.push({ module, message, details });
      },
      error() {}
    };
    const service = new VolcengineSpeechService({
      speechDirectory,
      config: { ...config, apiKey: "", accessToken: "" },
      fetchImpl: vi.fn() as never,
      logger
    });

    const alert = await service.createSponsorSpeech(sponsor());

    expect(alert).toBeNull();
    expect(existsSync(join(speechDirectory, "doubao-1-doubao.mp3"))).toBe(false);
    expect(entries).toContainEqual({
      module: "speech",
      message: "doubao speech skipped",
      details: expect.objectContaining({ reason: "not configured" })
    });
  });

  it("falls back to legacy AppID and AccessToken headers when API key is absent", async () => {
    const speechDirectory = await createTempSpeechDirectory();
    const fetchCalls: Array<{ init: RequestInit }> = [];
    const service = new VolcengineSpeechService({
      speechDirectory,
      config: { ...config, apiKey: "" },
      fetchImpl: vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push({ init: init ?? {} });
        return new Response(JSON.stringify({ code: 0, data: Buffer.from("audio").toString("base64") }), { status: 200 });
      }) as never
    });

    const alert = await service.createSponsorSpeech(sponsor());

    expect(alert?.url).toBe("/speech/doubao-1-doubao.mp3");
    expect(fetchCalls[0]?.init.headers).toEqual(
      expect.objectContaining({
        "X-Api-App-Key": "aGjiRDfUWi",
        "X-Api-App-Id": "app-id",
        "X-Api-Access-Key": "secret-token",
        "X-Api-Resource-Id": "seed-tts-2.0"
      })
    );
  });

  it("returns null when the Doubao API returns an error", async () => {
    const speechDirectory = await createTempSpeechDirectory();
    const entries: Array<{ module: string; message: string; details?: Record<string, unknown> }> = [];
    const logger = {
      info() {},
      warn(module: string, message: string, details?: Record<string, unknown>) {
        entries.push({ module, message, details });
      },
      error() {}
    };
    const service = new VolcengineSpeechService({
      speechDirectory,
      config,
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ code: 3001, message: "bad voice" }), { status: 200 })) as never,
      logger
    });

    const alert = await service.createSponsorSpeech(sponsor());

    expect(alert).toBeNull();
    expect(entries).toContainEqual({
      module: "speech",
      message: "doubao speech failed",
      details: expect.objectContaining({ errorMessage: expect.stringContaining("bad voice") })
    });
  });

  it("logs response bodies for HTTP failures without leaking credentials", async () => {
    const speechDirectory = await createTempSpeechDirectory();
    const entries: Array<{ module: string; message: string; details?: Record<string, unknown> }> = [];
    const logger = {
      info() {},
      warn(module: string, message: string, details?: Record<string, unknown>) {
        entries.push({ module, message, details });
      },
      error() {}
    };
    const service = new VolcengineSpeechService({
      speechDirectory,
      config,
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: "unauthorized", log_id: "abc123" }), { status: 401 })) as never,
      logger
    });

    const alert = await service.createSponsorSpeech(sponsor());

    expect(alert).toBeNull();
    expect(entries).toContainEqual({
      module: "speech",
      message: "doubao speech failed",
      details: expect.objectContaining({
        errorMessage: expect.stringContaining("unauthorized")
      })
    });
    expect(JSON.stringify(entries)).toContain("abc123");
    expect(JSON.stringify(entries)).not.toContain("api-key");
    expect(JSON.stringify(entries)).not.toContain("secret-token");
  });
});
