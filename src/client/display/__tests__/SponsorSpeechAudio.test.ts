import { afterEach, describe, expect, it, vi } from "vitest";
import { SponsorSpeechAudio } from "../SponsorSpeechAudio";

describe("SponsorSpeechAudio", () => {
  const originalAudio = globalThis.Audio;
  const originalWindow = (globalThis as { window?: Window }).window;

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalAudio) {
      globalThis.Audio = originalAudio;
    } else {
      delete (globalThis as { Audio?: typeof Audio }).Audio;
    }

    if (originalWindow) {
      (globalThis as { window?: Window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  });

  it("falls back to browser speech when audio playback is rejected", async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    const audioPlay = vi.fn(() => Promise.reject(new Error("blocked")));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    class FakeAudio {
      public volume = 0;

      public constructor(public readonly src: string) {}

      public play(): Promise<void> {
        return audioPlay();
      }
    }

    class FakeUtterance {
      public readonly text: string;

      public constructor(text: string) {
        this.text = text;
      }
    }

    (globalThis as { Audio?: typeof Audio }).Audio = FakeAudio as unknown as typeof Audio;
    (globalThis as { window?: Window }).window = {
      SpeechSynthesisUtterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      speechSynthesis: {
        cancel,
        speak
      } as unknown as SpeechSynthesis,
      addEventListener: () => undefined
    } as unknown as Window;

    const player = new SponsorSpeechAudio();

    await player.play({
      id: "speech-1",
      url: "/speech/speech-1.wav",
      text: "点将 1.9根",
      createdAt: 1
    });

    expect(audioPlay).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      "[StreamChargeOverlay][Speech] Browser audio playback failed",
      expect.objectContaining({
        id: "speech-1",
        url: "/speech/speech-1.wav",
        errorMessage: "blocked"
      })
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect((speak.mock.calls[0]?.[0] as FakeUtterance | undefined)?.text).toBe("点将 1.9根");
  });
});
