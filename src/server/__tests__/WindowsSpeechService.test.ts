import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SponsorRecord } from "../../shared/types";
import { WindowsSpeechService } from "../services/WindowsSpeechService";

describe("WindowsSpeechService", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  const createTempSpeechDirectory = async () => {
    const directory = await mkdtemp(join(tmpdir(), "stream-charge-speech-"));
    tempDirs.push(directory);
    return directory;
  };

  const sponsor = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
    id: "speech-1",
    bossName: "Alpha",
    amount: 188,
    programName: "Program",
    note: "Note",
    countsTowardCharge: true,
    createdAt: 1,
    ...overrides
  });

  it("falls back to any installed system voice when a zh-CN female voice is missing", () => {
    const service = new WindowsSpeechService("C:\\speech") as unknown as {
      buildPowerShellScript(text: string, filePath: string): string;
    };

    const script = service.buildPowerShellScript("测试语音", "C:\\speech\\test.wav");

    expect(script).toContain("$voices = $synth.GetInstalledVoices($culture)");
    expect(script).toContain("$fallbackVoices = $synth.GetInstalledVoices()");
    expect(script).toContain("$synth.SelectVoice($voices[0].VoiceInfo.Name)");
    expect(script).toContain("$synth.SelectVoice($fallbackVoices[0].VoiceInfo.Name)");
    expect(script).toContain("[StreamChargeOverlay][Speech] Requested voice culture: zh-CN");
    expect(script).toContain("[StreamChargeOverlay][Speech] Selected voice:");
    expect(script).toContain("[StreamChargeOverlay][Speech] Writing wav:");
    expect(script).not.toContain("SelectVoiceByHints");
  });

  it("logs speech generation diagnostics when PowerShell fails", async () => {
    const speechDirectory = await createTempSpeechDirectory();
    const service = new WindowsSpeechService(speechDirectory) as unknown as {
      createSponsorSpeech(record: SponsorRecord): Promise<unknown>;
      generateWave(): Promise<void>;
    };
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    service.generateWave = async () => {
      const error = new Error("PowerShell exited with code 1") as Error & {
        stdout?: string;
        stderr?: string;
      };
      error.stdout = "[StreamChargeOverlay][Speech] Installed voices: 0";
      error.stderr = "System.Speech failed";
      throw error;
    };

    const alert = await service.createSponsorSpeech(sponsor());

    expect(alert).toBeNull();
    expect(warning).toHaveBeenCalledWith(
      "[StreamChargeOverlay][Speech] Failed to generate speech file",
      expect.objectContaining({
        sponsorId: "speech-1",
        filePath: expect.stringContaining("speech-1.wav"),
        errorMessage: "PowerShell exited with code 1",
        stdout: "[StreamChargeOverlay][Speech] Installed voices: 0",
        stderr: "System.Speech failed"
      })
    );
  });
});
