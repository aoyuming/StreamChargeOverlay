import { afterEach, describe, expect, it } from "vitest";
import { ProgressEffectLayer } from "../ProgressEffectLayer";

class FakeGradient {
  public addColorStop(): void {}
}

class FakeContext {
  public readonly calls: unknown[][] = [];
  public fillStyle = "";
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

  public bezierCurveTo(...args: unknown[]): void {
    this.calls.push(["bezierCurveTo", ...args]);
  }

  public clearRect(...args: unknown[]): void {
    this.calls.push(["clearRect", ...args]);
  }

  public clip(): void {
    this.calls.push(["clip"]);
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

  public rect(...args: unknown[]): void {
    this.calls.push(["rect", ...args]);
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

describe("ProgressEffectLayer", () => {
  const originalWindow = (globalThis as { window?: Window }).window;

  afterEach(() => {
    if (originalWindow) {
      (globalThis as { window?: Window }).window = originalWindow;
      return;
    }

    delete (globalThis as { window?: Window }).window;
  });

  it("clips canvas effects to the charged width", () => {
    let animationCallback: FrameRequestCallback | undefined;
    (globalThis as { window?: Partial<Window> }).window = {
      addEventListener: () => undefined,
      devicePixelRatio: 1,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        animationCallback ??= callback;
        return 1;
      }
    };
    const context = new FakeContext();
    const canvas = {
      getBoundingClientRect: () => ({ width: 620, height: 58 }),
      getContext: () => context,
      height: 58,
      width: 620
    } as unknown as HTMLCanvasElement;

    const layer = new ProgressEffectLayer(canvas);
    layer.setState("fire", 50);
    animationCallback?.(100);

    const clipIndex = context.calls.findIndex((call) => call[0] === "clip");
    const rectIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["rect", 0, 0, 310, 58]));
    expect(rectIndex).toBeGreaterThan(-1);
    expect(clipIndex).toBeGreaterThan(rectIndex);
  });

  it("keeps inferno flame motion slower between nearby frames", () => {
    const renderFrame = (time: number): unknown[][] => {
      let animationCallback: FrameRequestCallback | undefined;
      (globalThis as { window?: Partial<Window> }).window = {
        addEventListener: () => undefined,
        devicePixelRatio: 1,
        requestAnimationFrame: (callback: FrameRequestCallback) => {
          animationCallback ??= callback;
          return 1;
        }
      };
      const context = new FakeContext();
      const canvas = {
        getBoundingClientRect: () => ({ width: 620, height: 58 }),
        getContext: () => context,
        height: 58,
        width: 620
      } as unknown as HTMLCanvasElement;

      const layer = new ProgressEffectLayer(canvas);
      layer.setState("inferno", 80);
      animationCallback?.(time);

      return context.calls.filter((call) => call[0] === "bezierCurveTo");
    };
    const firstFrame = renderFrame(0);
    const nextFrame = renderFrame(180);
    const averageVerticalShift =
      firstFrame.reduce((sum, call, index) => sum + Math.abs(Number(call[6]) - Number(nextFrame[index]?.[6])), 0) /
      firstFrame.length;

    expect(firstFrame.length).toBeGreaterThan(0);
    expect(averageVerticalShift).toBeLessThan(11);
  });

  it("draws progress fire as irregular bezier tongues instead of cone spikes", () => {
    let animationCallback: FrameRequestCallback | undefined;
    (globalThis as { window?: Partial<Window> }).window = {
      addEventListener: () => undefined,
      devicePixelRatio: 1,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        animationCallback ??= callback;
        return 1;
      }
    };
    const context = new FakeContext();
    const canvas = {
      getBoundingClientRect: () => ({ width: 620, height: 58 }),
      getContext: () => context,
      height: 58,
      width: 620
    } as unknown as HTMLCanvasElement;

    const layer = new ProgressEffectLayer(canvas);
    layer.setState("fire", 72);
    animationCallback?.(220);

    const bezierCurves = context.calls.filter((call) => call[0] === "bezierCurveTo");
    const quadraticCurves = context.calls.filter((call) => call[0] === "quadraticCurveTo");
    const controlXValues = new Set(bezierCurves.map((call) => Math.round(Number(call[1]))));

    expect(bezierCurves.length).toBeGreaterThan(20);
    expect(quadraticCurves).toHaveLength(0);
    expect(controlXValues.size).toBeGreaterThan(8);
  });

  it("draws the water progress stage with wave curves and bubbles", () => {
    let animationCallback: FrameRequestCallback | undefined;
    (globalThis as { window?: Partial<Window> }).window = {
      addEventListener: () => undefined,
      devicePixelRatio: 1,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        animationCallback ??= callback;
        return 1;
      }
    };
    const context = new FakeContext();
    const canvas = {
      getBoundingClientRect: () => ({ width: 620, height: 58 }),
      getContext: () => context,
      height: 58,
      width: 620
    } as unknown as HTMLCanvasElement;

    const layer = new ProgressEffectLayer(canvas);
    layer.setState("water", 52);
    animationCallback?.(260);

    const waveCurves = context.calls.filter((call) => call[0] === "quadraticCurveTo");
    const bubbles = context.calls.filter((call) => call[0] === "arc");

    expect(waveCurves.length).toBeGreaterThan(6);
    expect(bubbles.length).toBeGreaterThan(4);
  });

  it("draws the steam transition stage with water motion and vapor bubbles", () => {
    let animationCallback: FrameRequestCallback | undefined;
    (globalThis as { window?: Partial<Window> }).window = {
      addEventListener: () => undefined,
      devicePixelRatio: 1,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        animationCallback ??= callback;
        return 1;
      }
    };
    const context = new FakeContext();
    const canvas = {
      getBoundingClientRect: () => ({ width: 620, height: 58 }),
      getContext: () => context,
      height: 58,
      width: 620
    } as unknown as HTMLCanvasElement;

    const layer = new ProgressEffectLayer(canvas);
    layer.setState("steam", 66);
    animationCallback?.(420);

    const waveCurves = context.calls.filter((call) => call[0] === "quadraticCurveTo");
    const vaporBubbles = context.calls.filter((call) => call[0] === "arc");

    expect(waveCurves.length).toBeGreaterThan(6);
    expect(vaporBubbles.length).toBeGreaterThan(8);
  });
});
