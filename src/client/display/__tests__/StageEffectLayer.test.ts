import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_STAGE_EFFECT_PARTICLES,
  STAGE_EFFECT_DURATION_MS,
  StageEffectLayer,
  buildLightningBoltPoints,
  clampStageEffectDevicePixelRatio
} from "../StageEffectLayer";

class FakeGradient {
  public addColorStop(): void {}
}

class FakeContext {
  public readonly calls: unknown[][] = [];
  public fillStyle = "";
  public globalAlpha = 1;
  public globalCompositeOperation = "";
  public lineWidth = 0;
  public shadowBlur = 0;
  public shadowColor = "";
  public strokeStyle = "";

  public arc(...args: unknown[]): void {
    this.calls.push(["arc", ...args]);
  }

  public beginPath(): void {
    this.calls.push(["beginPath"]);
  }

  public clearRect(...args: unknown[]): void {
    this.calls.push(["clearRect", ...args]);
  }

  public closePath(): void {
    this.calls.push(["closePath"]);
  }

  public createLinearGradient(): FakeGradient {
    return new FakeGradient();
  }

  public createRadialGradient(): FakeGradient {
    return new FakeGradient();
  }

  public fill(): void {
    this.calls.push(["fill"]);
  }

  public fillRect(...args: unknown[]): void {
    this.calls.push(["fillRect", ...args]);
  }

  public lineTo(...args: unknown[]): void {
    this.calls.push(["lineTo", ...args]);
  }

  public moveTo(...args: unknown[]): void {
    this.calls.push(["moveTo", ...args]);
  }

  public quadraticCurveTo(...args: unknown[]): void {
    this.calls.push(["quadraticCurveTo", ...args]);
  }

  public restore(): void {
    this.calls.push(["restore"]);
  }

  public save(): void {
    this.calls.push(["save"]);
  }

  public setTransform(...args: unknown[]): void {
    this.calls.push(["setTransform", ...args]);
  }

  public stroke(): void {
    this.calls.push(["stroke"]);
  }
}

describe("StageEffectLayer", () => {
  const originalWindow = (globalThis as { window?: Window }).window;

  afterEach(() => {
    if (originalWindow) {
      (globalThis as { window?: Window }).window = originalWindow;
      return;
    }

    delete (globalThis as { window?: Window }).window;
  });

  it("caps DPR and particle budget for full-stage effects", () => {
    expect(clampStageEffectDevicePixelRatio(3)).toBe(1.25);
    expect(clampStageEffectDevicePixelRatio(1)).toBe(1);
    expect(MAX_STAGE_EFFECT_PARTICLES).toBeLessThanOrEqual(260);
  });

  it("plays a sponsor effect and stops after the configured duration", () => {
    const callbacks: FrameRequestCallback[] = [];
    (globalThis as { window?: Partial<Window> }).window = {
      addEventListener: () => undefined,
      devicePixelRatio: 2,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }
    };
    const context = new FakeContext();
    const canvas = {
      getBoundingClientRect: () => ({ width: 1920, height: 1440 }),
      getContext: () => context,
      height: 1440,
      width: 1920
    } as unknown as HTMLCanvasElement;

    const layer = new StageEffectLayer(canvas);
    layer.playSponsorEffect("lightning");
    callbacks[0]?.(0);
    callbacks[1]?.(STAGE_EFFECT_DURATION_MS + 1);

    expect(context.calls.some((call) => call[0] === "stroke")).toBe(true);
    expect(context.calls.at(-1)).toEqual(["clearRect", 0, 0, 1920, 1440]);
    expect(callbacks).toHaveLength(2);
  });

  it("builds jagged diagonal lightning bolt paths instead of straight screen cracks", () => {
    const points = buildLightningBoltPoints({
      amplitude: 120,
      endX: 1540,
      endY: 1120,
      progress: 0.42,
      seed: 7,
      segments: 9,
      startX: 260,
      startY: 0
    });
    const horizontalTravel = points.slice(1).reduce((sum, point, index) => {
      return sum + Math.abs(point.x - points[index].x);
    }, 0);
    const uniqueXValues = new Set(points.map((point) => Math.round(point.x / 10) * 10));

    expect(points).toHaveLength(10);
    expect(points[0]).toEqual({ x: 260, y: 0 });
    expect(points.at(-1)).toEqual({ x: 1540, y: 1120 });
    expect(horizontalTravel).toBeGreaterThan(1280);
    expect(uniqueXValues.size).toBeGreaterThan(7);
  });

  it("draws the dianjiang effect as a center burst", () => {
    const callbacks: FrameRequestCallback[] = [];
    (globalThis as { window?: Partial<Window> }).window = {
      addEventListener: () => undefined,
      devicePixelRatio: 1,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }
    };
    const context = new FakeContext();
    const canvas = {
      getBoundingClientRect: () => ({ width: 1920, height: 1440 }),
      getContext: () => context,
      height: 1440,
      width: 1920
    } as unknown as HTMLCanvasElement;

    const layer = new StageEffectLayer(canvas);
    layer.playDianjiangEffect();
    callbacks[0]?.(100);

    expect(context.calls.some((call) => call[0] === "arc")).toBe(true);
    expect(context.calls.some((call) => call[0] === "fillRect")).toBe(true);
  });
});
