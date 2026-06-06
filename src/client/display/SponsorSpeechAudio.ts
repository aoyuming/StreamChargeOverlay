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
      console.info("[StreamChargeOverlay][Speech] Playing speech audio", {
        id: alert.id,
        url: alert.url,
        textLength: alert.text.length
      });
      await audio.play();
      console.info("[StreamChargeOverlay][Speech] Speech audio playback started", {
        id: alert.id,
        url: alert.url
      });
      return;
    } catch (error) {
      console.warn("[StreamChargeOverlay][Speech] Browser audio playback failed", {
        id: alert.id,
        url: alert.url,
        ...this.describeError(error)
      });
      this.playFallbackSpeech(alert.text, alert.id);
    }
  }

  private playFallbackSpeech(text: string, id: string): void {
    if (!this.speechWindow.speechSynthesis || !this.speechWindow.SpeechSynthesisUtterance) {
      console.warn("[StreamChargeOverlay][Speech] Browser speech synthesis unavailable", {
        id,
        textLength: text.length
      });
      return;
    }

    const utterance = new this.speechWindow.SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.08;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    utterance.onerror = (event) => {
      console.warn("[StreamChargeOverlay][Speech] Browser fallback speech failed", {
        id,
        error: event.error
      });
    };

    console.info("[StreamChargeOverlay][Speech] Using browser speech fallback", {
      id,
      textLength: text.length
    });
    this.speechWindow.speechSynthesis.cancel();
    this.speechWindow.speechSynthesis.speak(utterance);
  }

  private describeError(error: unknown): Record<string, unknown> {
    return {
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}
