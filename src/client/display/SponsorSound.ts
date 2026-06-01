type BrowserWindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

interface SoundStep {
  frequency: number;
  startOffset: number;
  duration: number;
}

// 新赞助提示音用 Web Audio 合成，避免 demo 依赖外部音频素材。
export class SponsorSound {
  private audioContext: AudioContext | null = null;

  public async play(): Promise<void> {
    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      await context.resume().catch(() => undefined);
    }

    const steps: SoundStep[] = [
      { frequency: 523.25, startOffset: 0, duration: 0.12 },
      { frequency: 783.99, startOffset: 0.11, duration: 0.14 },
      { frequency: 1046.5, startOffset: 0.25, duration: 0.22 }
    ];

    for (const step of steps) {
      this.playTone(context, step);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext;
    }

    const audioWindow = window as BrowserWindowWithAudio;
    const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    this.audioContext = new AudioContextConstructor();
    return this.audioContext;
  }

  private playTone(context: AudioContext, step: SoundStep): void {
    const startTime = context.currentTime + step.startOffset;
    const endTime = startTime + step.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(step.frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(step.frequency * 1.025, endTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, startTime);
    filter.frequency.exponentialRampToValueAtTime(5200, endTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.03);
  }
}
