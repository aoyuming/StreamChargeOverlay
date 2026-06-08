import type { SpeechAlert } from "../../shared/types";

const SILENT_AUDIO_DATA_URL =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==";

type WindowWithObsStudio = Window & {
  obsstudio?: unknown;
};

export class SponsorSpeechAudio {
  private lastPlayedId = "";
  private retryNotice: HTMLButtonElement | null = null;
  private pendingAlert: SpeechAlert | null = null;

  public prepareUnlockNotice(): void {
    if (typeof document === "undefined" || this.isObsBrowserSource()) {
      return;
    }

    this.pendingAlert = null;
    const notice = this.retryNotice ?? this.createRetryNotice();
    notice.hidden = false;
    notice.textContent = "Enable Doubao voice";
    notice.title = "Click once before streaming so this browser can play Doubao voice automatically.";
  }

  public async play(alert: SpeechAlert): Promise<void> {
    if (alert.id === this.lastPlayedId) {
      return;
    }

    this.lastPlayedId = alert.id;
    await this.playAudio(alert);
  }

  private async playAudio(alert: SpeechAlert): Promise<void> {
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
      this.hideRetryNotice();
      return;
    } catch (error) {
      console.warn("[StreamChargeOverlay][Speech] Browser audio playback failed", {
        id: alert.id,
        url: alert.url,
        ...this.describeError(error)
      });
      this.showRetryNotice(alert, error);
      return;
    }
  }

  private showRetryNotice(alert: SpeechAlert, error: unknown): void {
    if (typeof document === "undefined") {
      return;
    }

    this.pendingAlert = alert;
    const notice = this.retryNotice ?? this.createRetryNotice();
    const message = this.describeError(error).errorMessage;
    notice.hidden = false;
    notice.textContent = "Click to enable Doubao voice";
    notice.title = `Doubao voice playback failed: ${String(message)}`;
  }

  private hideRetryNotice(): void {
    if (this.retryNotice) {
      this.retryNotice.hidden = true;
    }
  }

  private createRetryNotice(): HTMLButtonElement {
    const notice = document.createElement("button");
    notice.type = "button";
    notice.className = "speech-audio-retry-notice";
    notice.addEventListener("click", () => {
      void this.handleNoticeClick();
    });
    document.body.appendChild(notice);
    this.retryNotice = notice;
    return notice;
  }

  private async handleNoticeClick(): Promise<void> {
    if (this.pendingAlert) {
      await this.playAudio(this.pendingAlert);
      return;
    }

    await this.unlockBrowserAudio();
  }

  private async unlockBrowserAudio(): Promise<void> {
    try {
      const audio = new Audio(SILENT_AUDIO_DATA_URL);
      audio.volume = 0;
      await audio.play();
      console.info("[StreamChargeOverlay][Speech] Browser audio unlocked");
      this.hideRetryNotice();
    } catch (error) {
      console.warn("[StreamChargeOverlay][Speech] Browser audio unlock failed", this.describeError(error));
      if (this.retryNotice) {
        const message = this.describeError(error).errorMessage;
        this.retryNotice.hidden = false;
        this.retryNotice.textContent = "Click to enable Doubao voice";
        this.retryNotice.title = `Browser audio unlock failed: ${String(message)}`;
      }
    }
  }

  private isObsBrowserSource(): boolean {
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
    const hasObsBridge = typeof window !== "undefined" && Boolean((window as WindowWithObsStudio).obsstudio);
    return hasObsBridge || /obs|obs-browser|obsstudio/i.test(userAgent);
  }

  private describeError(error: unknown): Record<string, unknown> {
    return {
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}
