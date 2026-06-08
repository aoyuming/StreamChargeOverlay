import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { buildSponsorSpeechText } from "../../shared/displayUnits";
import type { SpeechAlert, SponsorRecord } from "../../shared/types";
import type { DoubaoTtsConfig } from "../config/AppConfig";
import type { SponsorSpeechService } from "../controllers/ApiController";
import type { ServerLogSink } from "../logging/ServerLogger";

interface VolcengineSpeechServiceOptions {
  speechDirectory: string;
  config: DoubaoTtsConfig;
  fetchImpl?: typeof fetch;
  logger?: ServerLogSink;
}

const DOUBAO_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const DOUBAO_APP_KEY = "aGjiRDfUWi";
const DOUBAO_UID = "stream-charge-overlay";
const OUTPUT_FORMAT = "mp3";
const DOUBAO_SUCCESS_CODES = new Set([0, 20000000]);

export class VolcengineSpeechService implements SponsorSpeechService {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: VolcengineSpeechServiceOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async createSponsorSpeech(record: SponsorRecord): Promise<SpeechAlert | null> {
    if (!this.isConfigured()) {
      this.options.logger?.warn("speech", "doubao speech skipped", {
        sponsorId: record.id,
        bossName: record.bossName,
        reason: "not configured"
      });
      return null;
    }

    const startedAt = Date.now();
    const text = buildSponsorSpeechText(record);
    const fileName = `${record.id}-doubao.${OUTPUT_FORMAT}`;
    const filePath = join(this.options.speechDirectory, fileName);

    try {
      this.options.logger?.info("speech", "doubao speech started", {
        sponsorId: record.id,
        bossName: record.bossName,
        textLength: text.length,
        voiceType: this.options.config.voiceType
      });

      const response = await this.fetchImpl(DOUBAO_TTS_ENDPOINT, {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify(this.requestBody(text))
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          errorBody ? `Doubao TTS HTTP ${response.status}: ${this.trimErrorBody(errorBody)}` : `Doubao TTS HTTP ${response.status}`
        );
      }

      const responseText = await response.text();
      const audio = this.decodeAudioChunks(responseText);
      if (audio.length === 0) {
        throw new Error("Doubao TTS returned empty audio");
      }

      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, audio);

      const url = `/speech/${encodeURIComponent(basename(filePath))}`;
      this.options.logger?.info("speech", "doubao speech ready", {
        sponsorId: record.id,
        bossName: record.bossName,
        voiceType: this.options.config.voiceType,
        durationMs: Date.now() - startedAt,
        byteLength: audio.length,
        url
      });

      return {
        id: record.id,
        url,
        text,
        createdAt: Date.now()
      };
    } catch (error) {
      this.options.logger?.warn("speech", "doubao speech failed", {
        sponsorId: record.id,
        bossName: record.bossName,
        voiceType: this.options.config.voiceType,
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  private isConfigured(): boolean {
    return Boolean(
      this.options.config.enabled &&
        (this.options.config.apiKey || (this.options.config.appId && this.options.config.accessToken))
    );
  }

  private requestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-App-Key": DOUBAO_APP_KEY,
      "X-Api-Resource-Id": this.options.config.resourceId,
      "X-Api-Request-Id": randomUUID()
    };

    if (this.options.config.apiKey) {
      headers["X-Api-Key"] = this.options.config.apiKey;
    } else {
      headers["X-Api-App-Id"] = this.options.config.appId;
      headers["X-Api-Access-Key"] = this.options.config.accessToken;
    }

    return headers;
  }

  private requestBody(text: string): Record<string, unknown> {
    return {
      user: {
        uid: DOUBAO_UID
      },
      req_params: {
        text,
        speaker: this.options.config.voiceType,
        audio_params: {
          format: OUTPUT_FORMAT,
          sample_rate: 24000,
          enable_timestamp: false
        },
        additions: JSON.stringify({
          explicit_language: "zh"
        })
      }
    };
  }

  private decodeAudioChunks(responseText: string): Buffer {
    const buffers: Buffer[] = [];

    for (const chunk of this.jsonChunks(responseText)) {
      const body = JSON.parse(chunk) as { code?: number; message?: string; data?: string };
      if (typeof body.code === "number" && !DOUBAO_SUCCESS_CODES.has(body.code)) {
        throw new Error(body.message || `Doubao TTS error code ${body.code}`);
      }
      if (body.data) {
        buffers.push(Buffer.from(body.data, "base64"));
      }
    }

    return Buffer.concat(buffers);
  }

  private jsonChunks(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      return lines;
    }

    return trimmed
      .replace(/}\s*{/g, "}\n{")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private trimErrorBody(body: string): string {
    return body.length > 500 ? `${body.slice(0, 500)}...` : body;
  }
}
