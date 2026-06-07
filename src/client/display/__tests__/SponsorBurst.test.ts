import { afterEach, describe, expect, it, vi } from "vitest";
import type { SponsorRecord } from "../../../shared/types";
import type { BurstParticles } from "../BurstParticles";
import { estimateSponsorBurstDurationMs, SponsorBurst } from "../SponsorBurst";

class FakeStyle {
  public backgroundImage = "";
  private readonly values = new Map<string, string>();

  public setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  public get(name: string): string | undefined {
    return this.values.get(name);
  }
}

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

class FakeElement {
  public textContent = "";
  public className = "";
  public readonly style = new FakeStyle();
  public readonly classList = new FakeClassList();

  public getBoundingClientRect(): Pick<DOMRect, "left" | "top" | "width" | "height"> {
    return { left: 100, top: 60, width: 760, height: 180 };
  }
}

const originalWindow = (globalThis as { window?: Window }).window;

const sponsor = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
  id: "sponsor-1",
  bossName: "Alpha",
  amount: 188,
  programName: "短节目",
  note: "短备注",
  countsTowardCharge: true,
  createdAt: 1,
  ...overrides
});

const createBurst = () => {
  const root = new FakeElement();
  const avatar = new FakeElement();
  const title = new FakeElement();
  const program = new FakeElement();
  const note = new FakeElement();
  const particles = {
    explode: vi.fn()
  };
  const timers: number[] = [];
  const clearTimeout = vi.fn();
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  const setTimeout = vi.fn((_callback: TimerHandler, timeout?: number) => {
    timers.push(Number(timeout));
    return timers.length;
  });

  (globalThis as { window?: Window }).window = {
    clearTimeout,
    requestAnimationFrame,
    setTimeout
  } as unknown as Window;

  return {
    root,
    avatar,
    title,
    program,
    note,
    particles,
    timers,
    burst: new SponsorBurst(
      root as unknown as HTMLElement,
      avatar as unknown as HTMLElement,
      title as unknown as HTMLElement,
      program as unknown as HTMLElement,
      note as unknown as HTMLElement,
      particles as unknown as BurstParticles
    )
  };
};

describe("SponsorBurst", () => {
  afterEach(() => {
    vi.restoreAllMocks();

    if (originalWindow) {
      (globalThis as { window?: Window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  });

  it("keeps short sponsor entries at the minimum burst duration", () => {
    expect(estimateSponsorBurstDurationMs("短句")).toBe(4200);

    const view = createBurst();
    view.burst.show(sponsor());

    expect(view.root.style.get("--burst-duration")).toBe("4200ms");
    expect(view.timers).toEqual([4200]);
  });

  it("extends long sponsor entries by speech length without exceeding the maximum duration", () => {
    const longSpeechText = "这是一段很长的老板入场朗读内容".repeat(12);

    expect(estimateSponsorBurstDurationMs(longSpeechText)).toBeGreaterThan(4200);
    expect(estimateSponsorBurstDurationMs(longSpeechText)).toBeLessThanOrEqual(9500);
    expect(estimateSponsorBurstDurationMs("超长".repeat(200))).toBe(9500);
  });

  it("prefers server speech text when estimating the visible duration", () => {
    const speechText = "服务端生成的朗读内容比较长".repeat(10);
    const view = createBurst();

    view.burst.show(sponsor({ programName: "短", note: "" }), speechText);

    expect(view.root.style.get("--burst-duration")).toBe(`${estimateSponsorBurstDurationMs(speechText)}ms`);
    expect(view.timers).toEqual([estimateSponsorBurstDurationMs(speechText)]);
  });

  it("renders program and note into separate wrapping lines", () => {
    const view = createBurst();

    view.burst.show(sponsor({ programName: "红眼竞速巴卡尔困难", note: "讲清楚装备搭配" }));

    expect(view.program.textContent).toBe("红眼竞速巴卡尔困难");
    expect(view.note.textContent).toBe("讲清楚装备搭配");
  });
});
