import type { SponsorRecord } from "../../shared/types";
import { buildSponsorSpeechText } from "../../shared/displayUnits";

type BrowserWindowWithSpeech = Window & {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
};

// 使用浏览器内置语音朗读。OBS 浏览器源是否有中文声音，取决于系统/CEF 可用语音包。
export class SponsorSpeech {
  private readonly speechWindow = window as BrowserWindowWithSpeech;

  public speak(record: SponsorRecord): void {
    if (!this.canSpeak()) {
      return;
    }

    const utterance = new this.speechWindow.SpeechSynthesisUtterance!(this.buildMessage(record));
    utterance.lang = "zh-CN";
    utterance.rate = 1.08;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    this.speechWindow.speechSynthesis!.cancel();
    this.speechWindow.speechSynthesis!.speak(utterance);
  }

  private canSpeak(): boolean {
    return Boolean(this.speechWindow.speechSynthesis && this.speechWindow.SpeechSynthesisUtterance);
  }

  private buildMessage(record: SponsorRecord): string {
    return buildSponsorSpeechText(record);
  }
}
