import { afterEach, describe, expect, it, vi } from "vitest";
import type { SponsorRecord } from "../../../shared/types";
import { SponsorSpeech } from "../SponsorSpeech";

describe("SponsorSpeech", () => {
  const originalWindow = (globalThis as { window?: Window }).window;

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalWindow) {
      (globalThis as { window?: Window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  });

  const sponsor = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
    id: "sponsor-1",
    bossName: "Alpha",
    amount: 188,
    programName: "Program",
    note: "Note",
    countsTowardCharge: true,
    createdAt: 1,
    ...overrides
  });

  it("logs when browser speech synthesis is unavailable", () => {
    (globalThis as { window?: Window }).window = {
      addEventListener: () => undefined
    } as unknown as Window;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const speech = new SponsorSpeech();
    speech.speak(sponsor());

    expect(warning).toHaveBeenCalledWith(
      "[StreamChargeOverlay][Speech] Browser speech synthesis unavailable",
      expect.objectContaining({
        sponsorId: "sponsor-1"
      })
    );
  });
});
