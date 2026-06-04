import type { SpeechAlert } from "../../shared/types";

type BrowserWindowWithSpeech = Window & {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
};

export class SponsorSpeechAudio {
  private lastPlayedId = "";
  private readonly speechWindow = window as BrowserWindowWithSpeech;

  public async play(alert: SpeechAlert): Promise<void> {
    if (alert.id === this.lastPlayedId) {
      return;
    }

    this.lastPlayedId = alert.id;
    const audio = new Audio(alert.url);
    audio.volume = 1;
    try {
      await audio.play();
      return;
    } catch {
      this.playFallbackSpeech(alert.text);
    }
  }

  private playFallbackSpeech(text: string): void {
    if (!this.speechWindow.speechSynthesis || !this.speechWindow.SpeechSynthesisUtterance) {
      return;
    }

    const utterance = new this.speechWindow.SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.08;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    this.speechWindow.speechSynthesis.cancel();
    this.speechWindow.speechSynthesis.speak(utterance);
  }
}
