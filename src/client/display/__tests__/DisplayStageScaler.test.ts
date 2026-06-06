import { describe, expect, it } from "vitest";
import { DisplayStageScaler } from "../DisplayStageScaler";

class FakeClassList {
  private readonly values = new Set<string>();

  public add(value: string): void {
    this.values.add(value);
  }

  public remove(value: string): void {
    this.values.delete(value);
  }

  public has(value: string): boolean {
    return this.values.has(value);
  }
}

class FakeStyle {
  private readonly values = new Map<string, string>();

  public setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  public get(name: string): string | undefined {
    return this.values.get(name);
  }
}

const createRoot = () => ({
  classList: new FakeClassList(),
  style: new FakeStyle()
});

const createViewport = (innerWidth: number, innerHeight: number) => ({
  innerWidth,
  innerHeight,
  listeners: new Set<() => void>(),
  addEventListener(_event: "resize", listener: () => void) {
    this.listeners.add(listener);
  },
  removeEventListener(_event: "resize", listener: () => void) {
    this.listeners.delete(listener);
  }
});

describe("DisplayStageScaler", () => {
  it("fits the 1920 by 1440 stage into smaller browser preview windows", () => {
    const root = createRoot();
    const viewport = createViewport(1280, 720);

    new DisplayStageScaler(root, viewport).start();

    expect(root.classList.has("is-preview-fit")).toBe(true);
    expect(root.style.get("--stage-scale")).toBe("0.5000");
    expect(root.style.get("--stage-offset-x")).toBe("160px");
  });

  it("keeps native scale when the viewport already matches the stage", () => {
    const root = createRoot();
    const viewport = createViewport(1920, 1440);

    new DisplayStageScaler(root, viewport).start();

    expect(root.classList.has("is-preview-fit")).toBe(false);
    expect(root.style.get("--stage-scale")).toBe("1.0000");
    expect(root.style.get("--stage-offset-x")).toBe("0px");
  });

  it("supports a 1920 by 1080 overlay stage without changing the legacy display default", () => {
    const root = createRoot();
    const viewport = createViewport(1280, 720);

    new DisplayStageScaler(root, viewport, { width: 1920, height: 1080 }).start();

    expect(root.classList.has("is-preview-fit")).toBe(true);
    expect(root.style.get("--stage-scale")).toBe("0.6667");
    expect(root.style.get("--stage-offset-x")).toBe("0px");
  });
});
