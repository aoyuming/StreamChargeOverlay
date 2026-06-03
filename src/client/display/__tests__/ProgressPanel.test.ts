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

const state = (progressPercent: number, overrides: Partial<DerivedAppState> = {}): DerivedAppState => ({
  targetAmount: 1000,
  slogan: "",
  sponsors: [],
  totalAmount: progressPercent * 10,
  progressPercent,
  goalReached: progressPercent >= 100,
  ranking: [],
  programQueue: [],
  ...overrides
});

const createPanel = () => {
  const currentBossList = element();
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
  return fakeElement.children.find((child) => child.className === className);
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
        note: "note first",
        programName: "selected program",
        createdAt: 2
      })
    ]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(firstCard.className).toBe("current-boss-row");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-name")?.textContent).toBe("New Boss");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-amount")?.textContent).toContain("6.28");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-note")?.textContent).toBe("note first");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-program")?.textContent).toBe("selected program");
    expect((firstCard.children[1] as FakeElement).className).toBe("current-boss-note");
    expect((firstCard.children[2] as FakeElement).className).toBe("current-boss-amount");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-label")).toBeUndefined();
    expect((view.currentBossList.classList as unknown as FakeClassList).has("is-scrolling-slow")).toBe(true);
    expect((view.currentBossList as unknown as FakeElement).children).toHaveLength(4);
  });

  it("keeps the program visible even when a current boss note is empty", () => {
    const view = createPanel();

    view.panel.render(state(30), [sponsor({ programName: "visible program", note: "" })]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-note")?.textContent).toBe("");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-program")?.textContent).toBe("visible program");
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

  it("renders the current root units with the target root units", () => {
    const view = createPanel();

    view.panel.render(state(62.8, { totalAmount: 628, targetAmount: 1000 }), [sponsor()]);

    expect(view.percentElement.textContent).toBe("6.28根（目标10根）");
    expect(view.percentElement.textContent).not.toContain("%");
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
    [39, "ice"],
    [40, "fire"],
    [69, "fire"],
    [70, "inferno"],
    [99, "inferno"],
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

  it("applies the stronger fire effect class without keeping the normal fire class", () => {
    const view = createPanel();

    view.panel.render(state(88.4), [sponsor()]);

    expect((view.progressTrack.classList as unknown as FakeClassList).has("is-inferno")).toBe(true);
    expect((view.progressTrack.classList as unknown as FakeClassList).has("is-fire")).toBe(false);
  });

  it("drives the cinematic progress effect layer with the active state", () => {
    const view = createPanel();

    view.panel.render(state(88.4), [sponsor()]);

    expect(view.progressEffects.states).toEqual([{ effect: "inferno", progressPercent: 88.4 }]);
  });
});
