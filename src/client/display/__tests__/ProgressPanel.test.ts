import { describe, expect, it } from "vitest";
import type { DerivedAppState, SponsorRecord } from "../../../shared/types";
import type { ProgressEffect } from "../ProgressPanel";
import { ProgressPanel, progressEffectFor } from "../ProgressPanel";

class FakeStyle {
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

  public remove(...values: string[]): void {
    values.forEach((value) => this.values.delete(value));
  }

  public toggle(value: string, enabled?: boolean): void {
    if (enabled ?? !this.values.has(value)) {
      this.values.add(value);
      return;
    }

    this.values.delete(value);
  }

  public has(value: string): boolean {
    return this.values.has(value);
  }
}

class FakeElement {
  public textContent = "";
  public className = "";
  public clientHeight = 0;
  public scrollHeight = 0;
  public readonly style = new FakeStyle();
  public readonly classList = new FakeClassList();
  public readonly children: FakeElement[] = [];
  public ownerDocument: FakeDocument | undefined;
  public parentElement: FakeElement | null = null;

  public append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  public replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    this.children.push(...children);
  }
}

class FakeDocument {
  public createElement(_tagName: string): FakeElement {
    const element = new FakeElement();
    element.ownerDocument = this;
    return element;
  }
}

class FakeProgressEffects {
  public readonly states: Array<{ effect: ProgressEffect; progressPercent: number }> = [];

  public setState(effect: ProgressEffect, progressPercent: number): void {
    this.states.push({ effect, progressPercent });
  }
}

const fakeDocument = new FakeDocument();
const element = () => {
  const node = new FakeElement();
  node.ownerDocument = fakeDocument;
  return node as unknown as HTMLElement;
};

const sponsor = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
  id: "sponsor-1",
  bossName: "Alpha Boss",
  amount: 300,
  programName: "program fallback",
  note: "",
  countsTowardCharge: true,
  createdAt: 1,
  ...overrides
});

const state = (progressPercent: number, overrides: Partial<DerivedAppState> = {}): DerivedAppState => ({
  targetAmount: 1000,
  slogan: "",
  sponsors: [],
  chargeConsumedAmount: 0,
  totalAmount: progressPercent * 10,
  progressPercent,
  goalReached: progressPercent >= 100,
  ranking: [],
  programQueue: [],
  ...overrides
});

const createPanel = (metrics: { viewportHeight?: number; listScrollHeight?: number } = {}) => {
  const currentBossList = element();
  const currentBossViewport = element();
  (currentBossViewport as unknown as FakeElement).clientHeight = metrics.viewportHeight ?? 143;
  (currentBossList as unknown as FakeElement).scrollHeight = metrics.listScrollHeight ?? 0;
  (currentBossList as unknown as FakeElement).parentElement = currentBossViewport as unknown as FakeElement;
  const progressTrack = element();
  const progressFill = element();
  const sloganElement = element();
  const percentElement = element();
  const progressEffects = new FakeProgressEffects();

  return {
    currentBossList,
    progressTrack,
    progressFill,
    sloganElement,
    percentElement,
    progressEffects,
    panel: new ProgressPanel(
      currentBossList,
      progressTrack,
      progressFill,
      sloganElement,
      percentElement,
      progressEffects
    )
  };
};

const childWithClass = (element: HTMLElement, className: string) => {
  const fakeElement = element as unknown as FakeElement;
  return fakeElement.children.find((child) => child.className.split(" ").includes(className));
};

describe("ProgressPanel", () => {
  it("renders the latest sponsor first in a compact current boss ticker row", () => {
    const view = createPanel();

    view.panel.render(state(62.8), [
      sponsor({ id: "old", bossName: "Old Boss", createdAt: 1 }),
      sponsor({
        id: "new",
        bossName: "New Boss",
        amount: 628,
        avatarUrl: "/avatars/alpha/new.webp",
        note: "note first",
        programName: "selected program",
        createdAt: 2
      })
    ]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.className).toContain("current-boss-row");
    expect(firstCard.className).toContain("is-tier-strong");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-name")?.textContent).toBe("New Boss");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-avatar")?.className).toContain("has-image");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-amount")?.textContent).toContain("6.3");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-note")?.textContent).toBe("note first");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-program")?.textContent).toBe("selected program");
    expect((firstCard.children[0] as FakeElement).className).toContain("current-boss-avatar");
    expect((firstCard.children[1] as FakeElement).className).toBe("current-boss-name");
    expect((firstCard.children[2] as FakeElement).className).toBe("current-boss-program");
    expect((firstCard.children[3] as FakeElement).className).toBe("current-boss-note");
    expect((firstCard.children[4] as FakeElement).className).toBe("current-boss-amount");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-label")).toBeUndefined();
    expect((view.currentBossList.classList as unknown as FakeClassList).has("is-scrolling-slow")).toBe(false);
    expect((view.currentBossList as unknown as FakeElement).children).toHaveLength(2);
  });

  it.each([
    [100, "is-tier-base"],
    [200, "is-tier-boosted"],
    [500, "is-tier-strong"],
    [1000, "is-tier-legend"]
  ])("uses amount tier class for %s amount", (amount, className) => {
    const view = createPanel();

    view.panel.render(state(40), [sponsor({ amount })]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.className).toContain(className);
  });

  it("keeps the program visible even when a current boss note is empty", () => {
    const view = createPanel();

    view.panel.render(state(30), [sponsor({ programName: "visible program", note: "" })]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-note")?.textContent).toBe("");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-program")?.textContent).toBe("visible program");
  });

  it("uses a placeholder current boss avatar when no avatar URL exists", () => {
    const view = createPanel();

    view.panel.render(state(30), [sponsor({ avatarUrl: undefined } as any)]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    const avatar = childWithClass(firstCard as unknown as HTMLElement, "current-boss-avatar");
    expect(avatar?.className).toContain("is-placeholder");
    expect(avatar?.textContent).toBe("A");
  });

  it("slows the current boss ticker as the list grows", () => {
    const view = createPanel({ listScrollHeight: 400 });
    const sponsors = Array.from({ length: 10 }, (_, index) =>
      sponsor({ id: `sponsor-${index}`, bossName: `Boss ${index}`, createdAt: index })
    );

    view.panel.render(state(62.8), sponsors);

    expect((view.currentBossList.style as unknown as FakeStyle).get("--current-boss-scroll-duration")).toBe("40s");
  });

  it("scrolls the current boss ticker only when the list overflows the viewport", () => {
    const view = createPanel({ viewportHeight: 143, listScrollHeight: 220 });
    const sponsors = [
      sponsor({ id: "one", bossName: "Boss 1", createdAt: 1 }),
      sponsor({ id: "two", bossName: "Boss 2", createdAt: 2 }),
      sponsor({ id: "three", bossName: "Boss 3", createdAt: 3 })
    ];

    view.panel.render(state(62.8), sponsors);

    expect((view.currentBossList.classList as unknown as FakeClassList).has("is-scrolling-slow")).toBe(true);
    expect((view.currentBossList as unknown as FakeElement).children).toHaveLength(6);
  });

  it("renders a waiting state when there is no current boss", () => {
    const view = createPanel();

    view.panel.render(state(0), []);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.textContent).toBe("等待大哥入场");
    expect(firstCard.className).toContain("is-empty");
  });

  it("renders the current root units with the target root units", () => {
    const view = createPanel();

    view.panel.render(state(62.8, { totalAmount: 628, targetAmount: 1000 }), [sponsor()]);

    expect(view.percentElement.textContent).toBe("6.3根（目标10根）");
    expect(view.percentElement.textContent).not.toContain("%");
  });

  it("renders a ready message instead of the target once charge reaches the goal", () => {
    const view = createPanel();

    view.panel.render(state(100, { totalAmount: 1000, targetAmount: 1000, goalReached: true }), [sponsor()]);

    expect(view.percentElement.textContent).toBe("10根（已达成，可以开始）");
  });

  it("keeps the ready message when charge is above the goal", () => {
    const view = createPanel();

    view.panel.render(state(100, { totalAmount: 1200, targetAmount: 1000, goalReached: true }), [sponsor()]);

    expect(view.percentElement.textContent).toBe("12根（已达成，可以开始）");
  });

  it("marks non-startup program rows for red display styling", () => {
    const view = createPanel();

    view.panel.render(state(40), [sponsor({ countsTowardCharge: false, programName: "selected program" })]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.className).toContain("is-program-only");
  });

  it("does not mark startup funding rows as program-only", () => {
    const view = createPanel();

    view.panel.render(state(40), [sponsor({ countsTowardCharge: true, programName: "启动资金" })]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.className).not.toContain("is-program-only");
  });

  it("sets the progress width on both the fill and effect track", () => {
    const view = createPanel();

    view.panel.render(state(62.8), [sponsor()]);

    expect((view.progressFill.style as unknown as FakeStyle).get("--progress")).toBe("62.8%");
    expect((view.progressTrack.style as unknown as FakeStyle).get("--progress")).toBe("62.8%");
  });

  it("renders the campaign slogan to the left of the charge summary", () => {
    const view = createPanel();

    view.panel.render(state(100, { slogan: "Tonight double rewards" }), [sponsor()]);

    expect(view.sloganElement.textContent).toBe("Tonight double rewards");
  });

  it("falls back to the progress label when the campaign slogan is empty", () => {
    const view = createPanel();

    view.panel.render(state(40), [sponsor()]);

    expect(view.sloganElement.textContent).toBe("充能进度");
  });

  it.each([
    [0, "ice"],
    [29.99, "ice"],
    [30, "water"],
    [59.99, "water"],
    [60, "steam"],
    [69.99, "steam"],
    [70, "fire"],
    [99.99, "fire"],
    [100, "lightning"]
  ] as const)("uses the %s percent progress effect", (percent, effect) => {
    expect(progressEffectFor(percent)).toBe(effect);
  });

  it("applies only the active progress effect class", () => {
    const view = createPanel();

    view.panel.render(state(100), [sponsor()]);

    expect((view.progressTrack.classList as unknown as FakeClassList).has("is-lightning")).toBe(true);
    expect((view.progressTrack.classList as unknown as FakeClassList).has("is-fire")).toBe(false);
  });

  it("applies the water-fire transition effect class without keeping water or fire", () => {
    const view = createPanel();

    view.panel.render(state(66.4), [sponsor()]);

    expect((view.progressTrack.classList as unknown as FakeClassList).has("is-steam")).toBe(true);
    expect((view.progressTrack.classList as unknown as FakeClassList).has("is-water")).toBe(false);
    expect((view.progressTrack.classList as unknown as FakeClassList).has("is-fire")).toBe(false);
  });

  it("drives the cinematic progress effect layer with the active state", () => {
    const view = createPanel();

    view.panel.render(state(88.4), [sponsor()]);

    expect(view.progressEffects.states).toEqual([{ effect: "fire", progressPercent: 88.4 }]);
  });
});
