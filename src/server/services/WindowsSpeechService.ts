import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { buildSponsorSpeechText } from "../../shared/displayUnits";
import type { SpeechAlert, SponsorRecord } from "../../shared/types";
import type { ServerLogSink } from "../logging/ServerLogger";

const execFileAsync = promisify(execFile);
const POWERSHELL_PATH = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

// Generates local Windows TTS WAV files so OBS can play normal audio files.
export class WindowsSpeechService {
  public constructor(private readonly speechDirectory: string, private readonly logger?: ServerLogSink) {}

  public async createSponsorSpeech(record: SponsorRecord): Promise<SpeechAlert | null> {
    const text = this.buildSpeechText(record);
    const fileName = `${record.id}.wav`;
    const filePath = join(this.speechDirectory, fileName);
    const context = {
      sponsorId: record.id,
      filePath,
      textLength: text.length
    };

    try {
      await mkdir(dirname(filePath), { recursive: true });
      this.info("generating speech file", { ...context, bossName: record.bossName });
      await this.generateWave(text, filePath);
      const url = `/speech/${encodeURIComponent(basename(filePath))}`;
      this.info("speech file ready", { ...context, bossName: record.bossName, url });
      return {
        id: record.id,
        url,
        text,
        createdAt: Date.now()
      };
    } catch (error) {
      this.warn("speech generation failed", {
        ...context,
        bossName: record.bossName,
        ...this.describeError(error)
      });
      return null;
    }
  }

  private buildSpeechText(record: SponsorRecord): string {
    return buildSponsorSpeechText(record);
  }

  private async generateWave(text: string, filePath: string): Promise<void> {
    const script = this.buildPowerShellScript(text, filePath);
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");

    const output = await execFileAsync(POWERSHELL_PATH, [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedCommand
    ]);
    this.logPowerShellOutput(filePath, output.stdout, output.stderr);
  }

  private buildPowerShellScript(text: string, filePath: string): string {
    const encodedText = Buffer.from(text, "utf8").toString("base64");
    const encodedPath = Buffer.from(filePath, "utf8").toString("base64");

    return `
$text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedText}'))
$path = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$culture = New-Object System.Globalization.CultureInfo('zh-CN')
Write-Host "[StreamChargeOverlay][Speech] Requested voice culture: zh-CN"
Write-Host "[StreamChargeOverlay][Speech] Text length: $($text.Length)"
$voices = $synth.GetInstalledVoices($culture)
$selectedVoice = $null
Write-Host "[StreamChargeOverlay][Speech] zh-CN voices: $($voices.Count)"
if ($voices.Count -gt 0) {
  $selectedVoice = $voices[0].VoiceInfo.Name
  $synth.SelectVoice($voices[0].VoiceInfo.Name)
} else {
  $fallbackVoices = $synth.GetInstalledVoices()
  Write-Host "[StreamChargeOverlay][Speech] fallback voices: $($fallbackVoices.Count)"
  if ($fallbackVoices.Count -gt 0) {
    $selectedVoice = $fallbackVoices[0].VoiceInfo.Name
    $synth.SelectVoice($fallbackVoices[0].VoiceInfo.Name)
  }
}
if ($selectedVoice) {
  Write-Host "[StreamChargeOverlay][Speech] Selected voice: $selectedVoice"
} else {
  Write-Warning "[StreamChargeOverlay][Speech] No installed system speech voices were found"
}
$synth.Rate = 1
$synth.Volume = 100
Write-Host "[StreamChargeOverlay][Speech] Writing wav: $path"
$synth.SetOutputToWaveFile($path)
$synth.Speak($text)
$synth.Dispose()
Write-Host "[StreamChargeOverlay][Speech] Wav finished: $path"
`;
  }

  private logPowerShellOutput(filePath: string, stdout: string | Buffer, stderr: string | Buffer): void {
    const stdoutText = stdout.toString().trim();
    const stderrText = stderr.toString().trim();

    if (stdoutText) {
      this.info("PowerShell stdout", { filePath, stdout: stdoutText });
    }

    if (stderrText) {
      this.warn("PowerShell stderr", { filePath, stderr: stderrText });
    }
  }

  private info(message: string, details: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.info("speech", message, details);
      return;
    }

    console.info(`[StreamChargeOverlay][Speech] ${message}`, details);
  }

  private warn(message: string, details: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.warn("speech", message, details);
      return;
    }

    const legacyMessage =
      message === "speech generation failed" ? "Failed to generate speech file" : message;
    console.warn(`[StreamChargeOverlay][Speech] ${legacyMessage}`, details);
  }

  private describeError(error: unknown): Record<string, unknown> {
    const details: Record<string, unknown> = {
      errorMessage: error instanceof Error ? error.message : String(error)
    };
    const processError = error as Partial<{
      code: string | number;
      signal: string;
      stdout: string | Buffer;
      stderr: string | Buffer;
    }>;

    if (processError.code !== undefined) {
      details.code = processError.code;
    }

    if (processError.signal) {
      details.signal = processError.signal;
    }

    if (processError.stdout) {
      details.stdout = processError.stdout.toString().trim();
    }

    if (processError.stderr) {
      details.stderr = processError.stderr.toString().trim();
    }

    return details;
  }
}
