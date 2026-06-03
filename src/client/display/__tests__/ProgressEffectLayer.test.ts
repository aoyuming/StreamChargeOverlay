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
});
