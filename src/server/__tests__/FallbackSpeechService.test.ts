import { describe, expect, it, vi } from "vitest";
import type { SpeechAlert, SponsorRecord } from "../../shared/types";
import { FallbackSpeechService } from "../services/FallbackSpeechService";

const sponsor = (): SponsorRecord => ({
  id: "fallback-1",
  bossName: "Fallback Boss",
  amount: 188,
  programName: "Fallback Program",
  note: "",
  countsTowardCharge: true,
  createdAt: 1
});

const alert = (id: string): SpeechAlert => ({
  id,
  url: `/speech/${id}.wav`,
  text: id,
  createdAt: 1
});

describe("FallbackSpeechService", () => {
  it("uses the primary speech service when it responds before the timeout", async () => {
    const primary = { createSponsorSpeech: vi.fn(async () => alert("primary")) };
    const fallback = { createSponsorSpeech: vi.fn(async () => alert("fallback")) };
    const service = new FallbackSpeechService(primary, fallback, { timeoutMs: 7000 });

    await expect(service.createSponsorSpeech(sponsor())).resolves.toEqual(alert("primary"));
    expect(fallback.createSponsorSpeech).not.toHaveBeenCalled();
  });

  it("falls back to Windows speech when the primary speech service fails", async () => {
    const primary = { createSponsorSpeech: vi.fn(async () => null) };
    const fallback = { createSponsorSpeech: vi.fn(async () => alert("fallback")) };
    const service = new FallbackSpeechService(primary, fallback, { timeoutMs: 7000 });

    await expect(service.createSponsorSpeech(sponsor())).resolves.toEqual(alert("fallback"));
    expect(fallback.createSponsorSpeech).toHaveBeenCalledOnce();
  });

  it("falls back after the configured timeout without waiting forever", async () => {
    vi.useFakeTimers();
    const primary = {
      createSponsorSpeech: vi.fn(
        () => new Promise<SpeechAlert | null>((resolve) => setTimeout(() => resolve(alert("primary")), 60_000))
      )
    };
    const fallback = { createSponsorSpeech: vi.fn(async () => alert("fallback")) };
    const service = new FallbackSpeechService(primary, fallback, { timeoutMs: 7000 });

    const resultPromise = service.createSponsorSpeech(sponsor());
    await vi.advanceTimersByTimeAsync(7000);

    await expect(resultPromise).resolves.toEqual(alert("fallback"));
    expect(fallback.createSponsorSpeech).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("returns null when both primary and fallback speech services fail", async () => {
    const primary = { createSponsorSpeech: vi.fn(async () => null) };
    const fallback = { createSponsorSpeech: vi.fn(async () => null) };
    const service = new FallbackSpeechService(primary, fallback, { timeoutMs: 7000 });

    await expect(service.createSponsorSpeech(sponsor())).resolves.toBeNull();
  });
});
