import { afterEach, describe, expect, it, vi } from "vitest";
import { SponsorSpeechAudio } from "../SponsorSpeechAudio";

describe("SponsorSpeechAudio", () => {
  const originalAudio = globalThis.Audio;
  const originalWindow = (globalThis as { window?: Window }).window;
  const originalDocument = (globalThis as { document?: Document }).document;

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

    if (originalDocument) {
      (globalThis as { document?: Document }).document = originalDocument;
    } else {
      delete (globalThis as { document?: Document }).document;
    }
  });

  it("does not fall back to browser speech when server audio playback is rejected", async () => {
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
    expect(cancel).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it("does not show the Doubao voice button before real playback failure", () => {
    const appended: unknown[] = [];
    const unlockButton = {
      type: "",
      className: "",
      textContent: "",
      title: "",
      hidden: false,
      style: {},
      addEventListener: vi.fn()
    };

    (globalThis as { document?: Document }).document = {
      body: {
        appendChild: (element: unknown) => {
          appended.push(element);
          return element;
        }
      },
      createElement: vi.fn(() => unlockButton)
    } as unknown as Document;

    const player = new SponsorSpeechAudio();
    player.prepareUnlockNotice();

    expect(appended).toEqual([]);
    expect(document.createElement).not.toHaveBeenCalled();
    expect(unlockButton.addEventListener).not.toHaveBeenCalled();
  });

  it("shows a retry notice and replays the same server audio when clicked", async () => {
    let clickHandler: (() => void) | undefined;
    const appended: unknown[] = [];
    const retryButton = {
      type: "",
      className: "",
      textContent: "",
      title: "",
      hidden: false,
      style: {},
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        clickHandler = handler;
      })
    };
    const audioPlay = vi.fn().mockRejectedValueOnce(new Error("blocked")).mockResolvedValueOnce(undefined);
    const sources: string[] = [];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    class FakeAudio {
      public volume = 0;

      public constructor(public readonly src: string) {
        sources.push(src);
      }

      public play(): Promise<void> {
        return audioPlay();
      }
    }

    (globalThis as { Audio?: typeof Audio }).Audio = FakeAudio as unknown as typeof Audio;
    (globalThis as { document?: Document }).document = {
      body: {
        appendChild: (element: unknown) => {
          appended.push(element);
          return element;
        }
      },
      createElement: vi.fn(() => retryButton)
    } as unknown as Document;

    const player = new SponsorSpeechAudio();

    await player.play({
      id: "speech-1",
      url: "/speech/speech-1-doubao.mp3",
      text: "speech text",
      createdAt: 1
    });

    expect(audioPlay).toHaveBeenCalledTimes(1);
    expect(appended).toEqual([retryButton]);
    expect(retryButton.className).toBe("speech-audio-retry-notice");
    expect(retryButton.textContent).toBe("点击启用豆包语音");
    expect(retryButton.title).toContain("blocked");
    expect(clickHandler).toBeTypeOf("function");

    clickHandler?.();
    await Promise.resolve();

    expect(audioPlay).toHaveBeenCalledTimes(2);
    expect(sources).toEqual(["/speech/speech-1-doubao.mp3", "/speech/speech-1-doubao.mp3"]);
    expect(retryButton.hidden).toBe(true);
  });
});
