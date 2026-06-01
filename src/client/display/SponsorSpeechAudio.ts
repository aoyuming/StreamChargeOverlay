import type { SpeechAlert } from "../../shared/types";

export class SponsorSpeechAudio {
  private lastPlayedId = "";

  public play(alert: SpeechAlert): void {
    if (alert.id === this.lastPlayedId) {
      return;
    }

    this.lastPlayedId = alert.id;
    const audio = new Audio(alert.url);
    audio.volume = 1;
    void audio.play().catch(() => undefined);
  }
}
