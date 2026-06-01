import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import type { SpeechAlert, SponsorRecord } from "../../shared/types";
import { formatSpeechAmount } from "./formatSpeechAmount";

const execFileAsync = promisify(execFile);
const POWERSHELL_PATH = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

// Windows 本地 TTS：生成 WAV 文件，让 OBS 浏览器源像播放普通音频一样播放朗读。
export class WindowsSpeechService {
  public constructor(private readonly speechDirectory: string) {}

  public async createSponsorSpeech(record: SponsorRecord): Promise<SpeechAlert | null> {
    const text = this.buildSpeechText(record);
    const fileName = `${record.id}.wav`;
    const filePath = join(this.speechDirectory, fileName);

    try {
      await mkdir(dirname(filePath), { recursive: true });
      await this.generateWave(text, filePath);
      return {
        id: record.id,
        url: `/speech/${encodeURIComponent(basename(filePath))}`,
        text,
        createdAt: Date.now()
      };
    } catch (error) {
      console.warn("生成朗读语音失败，已跳过语音文件。", error);
      return null;
    }
  }

  private buildSpeechText(record: SponsorRecord): string {
    const detail = record.note || record.programName;
    return `感谢 ${record.bossName} 老板赞助 ${formatSpeechAmount(record.amount)} 米，${detail}`;
  }

  private async generateWave(text: string, filePath: string): Promise<void> {
    const script = this.buildPowerShellScript(text, filePath);
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");

    await execFileAsync(POWERSHELL_PATH, [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedCommand
    ]);
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
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, $culture)
$synth.Rate = 1
$synth.Volume = 100
$synth.SetOutputToWaveFile($path)
$synth.Speak($text)
$synth.Dispose()
`;
  }
}
