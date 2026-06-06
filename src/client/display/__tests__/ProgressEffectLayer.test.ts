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

  it("clips overlay charge effects to the same trapezoid as the SVG bar before charged width", () => {
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
      dataset: { progressEffectMask: "overlay-charge" },
      getBoundingClientRect: () => ({ width: 620, height: 38 }),
      getContext: () => context,
      height: 38,
      width: 620
    } as unknown as HTMLCanvasElement;

    const layer = new ProgressEffectLayer(canvas);
    layer.setState("fire", 50);
    animationCallback?.(100);

    const trapezoidMoveIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["moveTo", 0, 0]));
    const topRightIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 620, 0]));
    const bottomRightIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 596, 38]));
    const bottomLeftIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 24, 38]));
    const rectIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["rect", 0, 0, 310, 38]));
    const clipIndices = context.calls.reduce<number[]>((indices, call, index) => {
      if (call[0] === "clip") {
        indices.push(index);
      }
      return indices;
    }, []);

    expect(trapezoidMoveIndex).toBeGreaterThan(-1);
    expect(topRightIndex).toBeGreaterThan(trapezoidMoveIndex);
    expect(bottomRightIndex).toBeGreaterThan(topRightIndex);
    expect(bottomLeftIndex).toBeGreaterThan(bottomRightIndex);
    expect(clipIndices).toHaveLength(2);
    expect(clipIndices[0]).toBeGreaterThan(bottomLeftIndex);
    expect(clipIndices[0]).toBeLessThan(rectIndex);
    expect(clipIndices[1]).toBeGreaterThan(rectIndex);
  });

  it("uses the normal charged-width clip when the overlay charge shape is rectangle", () => {
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
      dataset: { progressEffectMask: "overlay-charge", progressEffectShape: "rectangle" },
      getBoundingClientRect: () => ({ width: 620, height: 38 }),
      getContext: () => context,
      height: 38,
      width: 620
    } as unknown as HTMLCanvasElement;

    const layer = new ProgressEffectLayer(canvas);
    layer.setState("fire", 50);
    animationCallback?.(100);

    const bottomRightIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 596, 38]));
    const bottomLeftIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 24, 38]));
    const rectIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["rect", 0, 0, 310, 38]));
    const clipIndices = context.calls.reduce<number[]>((indices, call, index) => {
      if (call[0] === "clip") {
        indices.push(index);
      }
      return indices;
    }, []);

    expect(bottomRightIndex).toBe(-1);
    expect(bottomLeftIndex).toBe(-1);
    expect(rectIndex).toBeGreaterThan(-1);
    expect(clipIndices).toHaveLength(1);
    expect(clipIndices[0]).toBeGreaterThan(rectIndex);
  });

  it("clips overlay charge effects to the beveled six-sided bar shape", () => {
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
      dataset: { progressEffectMask: "overlay-charge", progressEffectShape: "beveled" },
      getBoundingClientRect: () => ({ width: 620, height: 38 }),
      getContext: () => context,
      height: 38,
      width: 620
    } as unknown as HTMLCanvasElement;

    const layer = new ProgressEffectLayer(canvas);
    layer.setState("fire", 50);
    animationCallback?.(100);

    const topLeftIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["moveTo", 22, 0]));
    const topRightIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 598, 0]));
    const rightPointIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 620, 19]));
    const bottomRightIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 598, 38]));
    const bottomLeftIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 22, 38]));
    const leftPointIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["lineTo", 0, 19]));
    const rectIndex = context.calls.findIndex((call) => JSON.stringify(call) === JSON.stringify(["rect", 0, 0, 310, 38]));

    expect(topLeftIndex).toBeGreaterThan(-1);
    expect(topRightIndex).toBeGreaterThan(topLeftIndex);
    expect(rightPointIndex).toBeGreaterThan(topRightIndex);
    expect(bottomRightIndex).toBeGreaterThan(rightPointIndex);
    expect(bottomLeftIndex).toBeGreaterThan(bottomRightIndex);
    expect(leftPointIndex).toBeGreaterThan(bottomLeftIndex);
    expect(rectIndex).toBeGreaterThan(leftPointIndex);
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
