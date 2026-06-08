import type { SpeechAlert, SponsorRecord } from "../../shared/types";
import type { SponsorSpeechService } from "../controllers/ApiController";
import type { ServerLogSink } from "../logging/ServerLogger";

interface FallbackSpeechServiceOptions {
  timeoutMs: number;
  logger?: ServerLogSink;
}

export class FallbackSpeechService implements SponsorSpeechService {
  public constructor(
    private readonly primary: SponsorSpeechService,
    private readonly fallback: SponsorSpeechService,
    private readonly options: FallbackSpeechServiceOptions
  ) {}

  public async createSponsorSpeech(record: SponsorRecord): Promise<SpeechAlert | null> {
    const primaryResult = await this.tryPrimary(record);
    if (primaryResult) {
      this.options.logger?.info("speech", "primary speech selected", {
        sponsorId: record.id,
        bossName: record.bossName,
        url: primaryResult.url
      });
      return primaryResult;
    }

    this.options.logger?.info("speech", "using fallback speech", {
      sponsorId: record.id,
      bossName: record.bossName
    });
    return this.fallback.createSponsorSpeech(record);
  }

  private async tryPrimary(record: SponsorRecord): Promise<SpeechAlert | null> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), this.options.timeoutMs);
      });
      const result = await Promise.race([this.primary.createSponsorSpeech(record), timeout]);

      if (!result) {
        this.options.logger?.warn("speech", "primary speech unavailable or timed out", {
          sponsorId: record.id,
          bossName: record.bossName,
          timeoutMs: this.options.timeoutMs
        });
      }

      return result;
    } catch (error) {
      this.options.logger?.warn("speech", "primary speech failed", {
        sponsorId: record.id,
        bossName: record.bossName,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
