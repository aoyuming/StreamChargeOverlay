import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_LAYOUT,
  applyOverlayLayout,
  decodeOverlayLayout,
  encodeOverlayLayout,
  loadOverlayLayout,
  resetOverlayLayout,
  saveOverlayLayout,
  storageKeyForRoom,
  type OverlayLayout
} from "../OverlayLayoutConfig";

class MemoryStorage implements Pick<Storage, "getItem" | "removeItem" | "setItem"> {
  public readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeStyle {
  public readonly values = new Map<string, string>();

  public setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }
}

describe("OverlayLayoutConfig", () => {
  it("uses screenshot-based defaults for the three overlay widgets", () => {
    expect(DEFAULT_OVERLAY_LAYOUT).toEqual({
      todayPrograms: { x: 1, y: 455, w: 339, h: 267, scale: 1.1, fontScale: 1 },
      recentRanking: { x: 1537, y: 819, w: 316, h: 250, scale: 1.2, fontScale: 1 },
      chargeBar: { x: 762, y: 922, w: 401, h: 24, scale: 1, fontScale: 1, shape: "rectangle" }
    });
  });

  it("round-trips compact layout links", () => {
    const encoded = encodeOverlayLayout({
      todayPrograms: { x: 10, y: 20, w: 300, h: 240, scale: 1.2, fontScale: 1 },
      recentRanking: { x: 1400, y: 820, w: 420, h: 220, scale: 0.9, fontScale: 1 },
      chargeBar: { x: 640, y: 860, w: 620, h: 52, scale: 1, fontScale: 1.3, shape: "beveled" }
    });

    expect(decodeOverlayLayout(encoded)).toEqual({
      todayPrograms: { x: 10, y: 20, w: 300, h: 240, scale: 1.2, fontScale: 1 },
      recentRanking: { x: 1400, y: 820, w: 420, h: 220, scale: 0.9, fontScale: 1 },
      chargeBar: { x: 640, y: 860, w: 620, h: 52, scale: 1, fontScale: 1.3, shape: "beveled" }
    });
  });

  it("migrates legacy charge bar scale into width and height instead of stretching text", () => {
    const encoded = encodeOverlayLayout({
      todayPrograms: { x: 6, y: 395, w: 356, h: 316, scale: 1, fontScale: 1 },
      recentRanking: { x: 1507, y: 845, w: 407, h: 228, scale: 1, fontScale: 1 },
      chargeBar: { x: 742, y: 879, w: 551, h: 48, scale: 0.8 }
    });

    expect(decodeOverlayLayout(encoded)?.chargeBar).toEqual({
      x: 742,
      y: 879,
      w: 441,
      h: 38,
      scale: 1,
      fontScale: 1,
      shape: "rectangle"
    });
  });

  it("prefers saved local storage over the URL layout during live adjustments", () => {
    const storage = new MemoryStorage();
    const saved: OverlayLayout = {
      todayPrograms: { x: 1, y: 1, w: 100, h: 100, scale: 1, fontScale: 1 },
      recentRanking: { x: 2, y: 2, w: 100, h: 100, scale: 1, fontScale: 1 },
      chargeBar: { x: 3, y: 3, w: 100, h: 40, scale: 1, fontScale: 1.4, shape: "rectangle" }
    };
    const urlLayout: OverlayLayout = {
      todayPrograms: { x: 12, y: 34, w: 320, h: 260, scale: 1.1, fontScale: 1 },
      recentRanking: { x: 1500, y: 810, w: 390, h: 240, scale: 1, fontScale: 1 },
      chargeBar: { x: 700, y: 870, w: 580, h: 50, scale: 1, fontScale: 1.1, shape: "beveled" }
    };
    storage.setItem(storageKeyForRoom("wenrou"), JSON.stringify(saved));

    const location = new URL(`http://localhost:3000/rooms/wenrou/overlay.html?layout=${encodeOverlayLayout(urlLayout)}`);

    expect(loadOverlayLayout(location, storage, "wenrou")).toEqual(saved);
  });

  it("upgrades rooms that only saved the previous built-in default layout", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      storageKeyForRoom("wenrou"),
      JSON.stringify({
        todayPrograms: { x: 6, y: 470, w: 356, h: 316, scale: 1, fontScale: 1 },
        recentRanking: { x: 1507, y: 818, w: 407, h: 250, scale: 1, fontScale: 1 },
        chargeBar: { x: 548, y: 104, w: 620, h: 38, scale: 1, fontScale: 1.18 }
      })
    );

    const location = new URL("http://localhost:3000/rooms/wenrou/overlay.html");

    expect(loadOverlayLayout(location, storage, "wenrou")).toEqual(DEFAULT_OVERLAY_LAYOUT);
  });

  it("uses the URL layout when no live layout has been saved", () => {
    const storage = new MemoryStorage();
    const urlLayout: OverlayLayout = {
      todayPrograms: { x: 12, y: 34, w: 320, h: 260, scale: 1.1, fontScale: 1 },
      recentRanking: { x: 1500, y: 810, w: 390, h: 240, scale: 1, fontScale: 1 },
      chargeBar: { x: 700, y: 870, w: 580, h: 50, scale: 1, fontScale: 1.1, shape: "rectangle" }
    };
    const location = new URL(`http://localhost:3000/rooms/wenrou/overlay.html?layout=${encodeOverlayLayout(urlLayout)}`);

    expect(loadOverlayLayout(location, storage, "wenrou")).toEqual(urlLayout);
  });

  it("saves, resets, and applies layout CSS variables", () => {
    const storage = new MemoryStorage();
    const style = new FakeStyle();
    const root = { style };

    saveOverlayLayout(storage, "wenrou", DEFAULT_OVERLAY_LAYOUT);
    expect(storage.getItem(storageKeyForRoom("wenrou"))).toContain("todayPrograms");

    applyOverlayLayout(root, DEFAULT_OVERLAY_LAYOUT);
    expect(style.values.get("--overlay-today-programs-x")).toBe("1px");
    expect(style.values.get("--overlay-today-programs-y")).toBe("455px");
    expect(style.values.get("--overlay-today-programs-scale")).toBe("1.1");
    expect(style.values.get("--overlay-recent-ranking-y")).toBe("819px");
    expect(style.values.get("--overlay-recent-ranking-w")).toBe("316px");
    expect(style.values.get("--overlay-recent-ranking-scale")).toBe("1.2");
    expect(style.values.get("--overlay-charge-bar-x")).toBe("762px");
    expect(style.values.get("--overlay-charge-bar-w")).toBe("401px");
    expect(style.values.get("--overlay-charge-bar-scale")).toBe("1");
    expect(style.values.get("--overlay-charge-bar-font-scale")).toBe("1");

    resetOverlayLayout(storage, "wenrou");
    expect(storage.getItem(storageKeyForRoom("wenrou"))).toBeNull();
  });
});
