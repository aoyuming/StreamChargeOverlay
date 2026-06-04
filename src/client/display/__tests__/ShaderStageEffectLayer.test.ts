import { afterEach, describe, expect, it } from "vitest";
import type { ProgressEffect } from "../ProgressPanel";
import { ShaderStageEffectLayer } from "../ShaderStageEffectLayer";
import type { StageEffectPlayer } from "../StageEffectLayer";

class FakeShader {
  public readonly cleared: boolean[] = [];
  public readonly renders: Array<{ effect: ProgressEffect | "dianjiang"; opacity: number; progressPercent: number }> = [];

  public clear(): void {
    this.cleared.push(true);
  }

  public render(
    effect: ProgressEffect | "dianjiang",
    progressPercent: number,
    _elapsedMs: number,
    opacity: number
  ): void {
    this.renders.push({ effect, opacity, progressPercent });
  }
}

class FakeStageEffects implements StageEffectPlayer {
  public readonly dianjiangCalls: boolean[] = [];
  public readonly sponsorEffects: ProgressEffect[] = [];

  public playDianjiangEffect(): void {
    this.dianjiangCalls.push(true);
  }

  public playSponsorEffect(effect: ProgressEffect): void {
    this.sponsorEffects.push(effect);
  }
}

const createLayer = (shader: FakeShader, fallback: FakeStageEffects): ShaderStageEffectLayer => {
  const LayerConstructor = ShaderStageEffectLayer as unknown as {
    new (shader: FakeShader, durationMs: number, fallback: StageEffectPlayer): ShaderStageEffectLayer;
  };
  return new LayerConstructor(shader, 2600, fallback);
};

describe("ShaderStageEffectLayer", () => {
  const originalWindow = (globalThis as { window?: Window }).window;

  afterEach(() => {
    if (originalWindow) {
      (globalThis as { window?: Window }).window = originalWindow;
      return;
    }

    delete (globalThis as { window?: Window }).window;
  });

  it("renders full-stage water and fire effects through shader and delegates other stage effects", () => {
    const callbacks: FrameRequestCallback[] = [];
    (globalThis as { window?: Partial<Window> }).window = {
      cancelAnimationFrame: () => undefined,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }
    };
    const shader = new FakeShader();
    const fallback = new FakeStageEffects();
    const layer = createLayer(shader, fallback);

    layer.playSponsorEffect("ice");
    layer.playSponsorEffect("water");
    callbacks[0]?.(100);
    layer.playSponsorEffect("lightning");
    layer.playSponsorEffect("fire");
    callbacks[1]?.(220);
    layer.playDianjiangEffect();

    expect(fallback.sponsorEffects).toEqual(["ice", "lightning"]);
    expect(fallback.dianjiangCalls).toHaveLength(1);
    expect(shader.renders).toEqual([
      { effect: "water", opacity: 0.64, progressPercent: 100 },
      { effect: "fire", opacity: 0.52, progressPercent: 100 }
    ]);
    expect(shader.cleared.length).toBeGreaterThan(0);
  });

  it("renders full-stage fire shader with reduced opacity so the background stays visible", () => {
    const callbacks: FrameRequestCallback[] = [];
    (globalThis as { window?: Partial<Window> }).window = {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }
    };
    const shader = new FakeShader();
    const fallback = new FakeStageEffects();
    const layer = createLayer(shader, fallback);

    layer.playSponsorEffect("inferno");
    callbacks[0]?.(100);

    expect(shader.renders[0]?.effect).toBe("inferno");
    expect(shader.renders[0]?.opacity).toBeLessThanOrEqual(0.58);
  });
});
