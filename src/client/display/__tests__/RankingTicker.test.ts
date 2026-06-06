import { afterEach, describe, expect, it } from "vitest";
import type { SponsorRankingItem } from "../../../shared/types";
import { RankingTicker } from "../RankingTicker";

class FakeClassList {
  private readonly values = new Set<string>();

  public toggle(value: string, enabled?: boolean): void {
    if (enabled ?? !this.values.has(value)) {
      this.values.add(value);
      return;
    }

    this.values.delete(value);
  }
}

class FakeElement {
  public className = "";
  public textContent = "";
  public readonly children: FakeElement[] = [];
  public readonly classList = new FakeClassList();
  public readonly style: { backgroundImage?: string } = {};

  public append(...children: Array<FakeElement | FakeDocumentFragment>): void {
    children.forEach((child) => {
      if (child instanceof FakeDocumentFragment) {
        this.children.push(...child.children);
        return;
      }

      this.children.push(child);
    });
  }

  public replaceChildren(...children: Array<FakeElement | FakeDocumentFragment>): void {
    this.children.length = 0;
    this.append(...children);
  }
}

class FakeDocumentFragment {
  public readonly children: FakeElement[] = [];

  public append(...children: FakeElement[]): void {
    this.children.push(...children);
  }
}

class FakeDocument {
  public createElement(_tagName: string): FakeElement {
    return new FakeElement();
  }

  public createDocumentFragment(): FakeDocumentFragment {
    return new FakeDocumentFragment();
  }
}

const rankingItem = (overrides: Partial<SponsorRankingItem> = {}): SponsorRankingItem => ({
  bossName: "Alpha Boss",
  totalAmount: 100,
  recordCount: 1,
  latestAt: 1,
  ...overrides
});

const childWithClass = (element: FakeElement, className: string) =>
  element.children.find((child) => child.className.split(" ").includes(className));

describe("RankingTicker", () => {
  const originalDocument = (globalThis as { document?: Document }).document;

  afterEach(() => {
    if (originalDocument) {
      (globalThis as { document?: Document }).document = originalDocument;
      return;
    }

    delete (globalThis as { document?: Document }).document;
  });

  it("applies DNF amount rarity classes to pinned and rolling ranking amounts", () => {
    (globalThis as { document?: Document }).document = new FakeDocument() as unknown as Document;
    const pinnedElement = new FakeElement();
    const listElement = new FakeElement();
    const ticker = new RankingTicker(pinnedElement as unknown as HTMLElement, listElement as unknown as HTMLElement);

    ticker.render([
      rankingItem({ bossName: "Pinned Blue", totalAmount: 100 }),
      rankingItem({ bossName: "Pinned Orange", totalAmount: 400 }),
      rankingItem({ bossName: "Rolling Gold", totalAmount: 500 })
    ]);

    const firstPinnedAmount = childWithClass(pinnedElement.children[0], "rank-amount");
    const secondPinnedAmount = childWithClass(pinnedElement.children[1], "rank-amount");
    const rollingAmount = childWithClass(listElement.children[0], "rank-amount");
    expect(firstPinnedAmount?.className).toContain("amount-rarity-advanced");
    expect(secondPinnedAmount?.className).toContain("amount-rarity-legendary");
    expect(rollingAmount?.className).toContain("amount-rarity-epic");
  });
});
