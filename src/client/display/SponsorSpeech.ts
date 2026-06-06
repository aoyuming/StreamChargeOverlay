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
      console.warn("[StreamChargeOverlay][Speech] Browser speech synthesis unavailable", {
        sponsorId: record.id
      });
      return;
    }

    const message = this.buildMessage(record);
    const utterance = new this.speechWindow.SpeechSynthesisUtterance!(message);
    utterance.lang = "zh-CN";
    utterance.rate = 1.08;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    utterance.onerror = (event) => {
      console.warn("[StreamChargeOverlay][Speech] Browser speech synthesis failed", {
        sponsorId: record.id,
        error: event.error
      });
    };

    console.info("[StreamChargeOverlay][Speech] Speaking with browser speech synthesis", {
      sponsorId: record.id,
      textLength: message.length
    });
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
