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
  public readonly style = new FakeStyle();
  public readonly classList = new FakeClassList();
  public readonly children: FakeElement[] = [];
  public ownerDocument: FakeDocument | undefined;

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
  createdAt: 1,
  ...overrides
});

const state = (progressPercent: number): DerivedAppState => ({
  targetAmount: 1000,
  slogan: "",
  sponsors: [],
  totalAmount: progressPercent * 10,
  progressPercent,
  goalReached: progressPercent >= 100,
  ranking: [],
  programQueue: []
});

const createPanel = () => {
  const currentBossList = element();
  const progressTrack = element();
  const progressFill = element();
  const percentElement = element();
  const progressEffects = new FakeProgressEffects();

  return {
    currentBossList,
    progressTrack,
    progressFill,
    percentElement,
    progressEffects,
    panel: new ProgressPanel(
      currentBossList,
      progressTrack,
      progressFill,
      percentElement,
      progressEffects
    )
  };
};

const childWithClass = (element: HTMLElement, className: string) => {
  const fakeElement = element as unknown as FakeElement;
  return fakeElement.children.find((child) => child.className === className);
};

describe("ProgressPanel", () => {
  it("renders the latest sponsor first in a compact current boss ticker row", () => {
    const view = createPanel();

    view.panel.render(state(62.8), [
      sponsor({ id: "old", bossName: "Old Boss", createdAt: 1 }),
      sponsor({ id: "new", bossName: "New Boss", amount: 628, note: "note first", createdAt: 2 })
    ]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.className).toBe("current-boss-row");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-name")?.textContent).toBe("New Boss");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-amount")?.textContent).toContain("6.28");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-note")?.textContent).toBe("note first");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-label")).toBeUndefined();
    expect((view.currentBossList.classList as unknown as FakeClassList).has("is-scrolling-slow")).toBe(true);
    expect((view.currentBossList as unknown as FakeElement).children).toHaveLength(4);
  });

  it("falls back to the program name when a current boss note is empty", () => {
    const view = createPanel();

    view.panel.render(state(30), [sponsor({ programName: "visible program", note: "" })]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-note")?.textContent).toBe("visible program");
  });

  it("slows the current boss ticker as the list grows", () => {
    const view = createPanel();
    const sponsors = Array.from({ length: 10 }, (_, index) =>
      sponsor({ id: `sponsor-${index}`, bossName: `Boss ${index}`, createdAt: index })
    );

    view.panel.render(state(62.8), sponsors);

    expect((view.currentBossList.style as unknown as FakeStyle).get("--current-boss-scroll-duration")).toBe("40s");
  });

  it("renders a waiting state when there is no current boss", () => {
    const view = createPanel();

    view.panel.render(state(0), []);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.textContent).toBe("等待大哥入场");
    expect(firstCard.className).toContain("is-empty");
  });

  it("renders an integer progress percentage only", () => {
    const view = createPanel();

    view.panel.render(state(62.8), [sponsor()]);

    expect(view.percentElement.textContent).toBe("63%");
  });

  it.each([
    [0, "ice"],
    [39, "ice"],
    [40, "energy"],
    [79, "energy"],
    [80, "fire"],
    [99, "fire"],
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

  it("drives the cinematic progress effect layer with the active state", () => {
    const view = createPanel();

    view.panel.render(state(88.4), [sponsor()]);

    expect(view.progressEffects.states).toEqual([{ effect: "fire", progressPercent: 88.4 }]);
  });
});
