import { describe, expect, it } from "vitest";
import type { DerivedAppState, SponsorRecord } from "../../../shared/types";
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

const fakeDocument = new FakeDocument();
const element = () => {
  const node = new FakeElement();
  node.ownerDocument = fakeDocument;
  return node as unknown as HTMLElement;
};

const sponsor = (overrides: Partial<SponsorRecord> = {}): SponsorRecord => ({
  id: "sponsor-1",
  bossName: "赛博大哥",
  amount: 300,
  programName: "燃烧名场面",
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

  return {
    currentBossList,
    progressTrack,
    progressFill,
    percentElement,
    panel: new ProgressPanel(
      currentBossList,
      progressTrack,
      progressFill,
      percentElement
    )
  };
};

const childWithClass = (element: HTMLElement, className: string) => {
  const fakeElement = element as unknown as FakeElement;
  return fakeElement.children.find((child) => child.className === className);
};

describe("ProgressPanel", () => {
  it("renders the latest sponsor first in the slow current boss ticker", () => {
    const view = createPanel();

    view.panel.render(state(62.8), [
      sponsor({ id: "old", bossName: "旧大哥", createdAt: 1 }),
      sponsor({ id: "new", bossName: "最新大哥", amount: 628, createdAt: 2 })
    ]);

    const firstCard = (view.currentBossList as unknown as FakeElement).children[0];
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-name")?.textContent).toBe("最新大哥");
    expect(childWithClass(firstCard as unknown as HTMLElement, "current-boss-meta")?.textContent).toContain("6.28根");
    expect((view.currentBossList.classList as unknown as FakeClassList).has("is-scrolling-slow")).toBe(true);
    expect((view.currentBossList as unknown as FakeElement).children).toHaveLength(4);
  });

  it("slows the current boss ticker as the list grows", () => {
    const view = createPanel();
    const sponsors = Array.from({ length: 10 }, (_, index) =>
      sponsor({ id: `sponsor-${index}`, bossName: `大哥${index}`, createdAt: index })
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
});
