import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("OverlayLayoutEditor", () => {
  const source = readFileSync(resolve(process.cwd(), "src/client/overlay/OverlayLayoutEditor.ts"), "utf8");

  it("starts in full edit mode or live hover edit mode", () => {
    expect(source).toContain("fullEditor: boolean");
    expect(source).toContain("is-overlay-live-editing");
    expect(source).toContain("is-widget-editing");
    expect(source).toContain("activateWidget");
    expect(source).toContain("scheduleDeactivateWidget");
  });

  it("auto-saves layout changes after live drag, resize, and scale operations", () => {
    expect(source).toContain("autoSaveLayout");
    expect(source).toContain("this.autoSaveLayout();");
    expect(source).toContain("saveOverlayLayout(this.options.storage");
  });

  it("switches the active local layout room without rebuilding the page", () => {
    expect(source).toContain("switchRoom(roomSlug: string, layout: OverlayLayout)");
    expect(source).toContain("this.autoSaveLayout();");
    expect(source).toContain("this.roomSlug = roomSlug;");
    expect(source).toContain("this.layout = cloneLayout(layout);");
  });

  it("exports and imports compact layout parameters for sharing", () => {
    expect(source).toContain("exportLayoutParam(): string");
    expect(source).toContain("importLayoutParam(value: string): boolean");
    expect(source).toContain("encodeOverlayLayout(this.layout)");
    expect(source).toContain("decodeOverlayLayout");
    expect(source).toContain("extractLayoutParam");
    expect(source).toContain("saveOverlayLayout(this.options.storage, this.roomSlug, this.layout)");
  });

  it("exposes a reset method for the live control panel", () => {
    expect(source).toContain("resetToDefaultLayout(): void");
    expect(source).toContain("this.layout = cloneLayout(DEFAULT_OVERLAY_LAYOUT);");
    expect(source).toContain("resetOverlayLayout(this.options.storage, this.roomSlug);");
    expect(source).toContain("this.applyLayout();");
  });

  it("copies fixed overlay links without embedding room names", () => {
    expect(source).toContain('fixedPagePath("overlay")');
    expect(source).toContain('url.pathname = fixedPagePath("overlay")');
  });

  it("uses charge bar plus and minus controls for font scale instead of transform scale", () => {
    expect(source).toContain('if (key === "chargeBar")');
    expect(source).toContain("fontScale");
    expect(source).toContain("adjustChargeFontScale");
  });

  it("can set the charge bar to beveled, trapezoid, or rectangle SVG shapes", () => {
    expect(source).toContain("setChargeBarShape");
    expect(source).toContain("applyChargeBarShape");
    expect(source).toContain("beveled");
    expect(source).toContain("trapezoid");
    expect(source).toContain("rectangle");
    expect(source).toContain("22 0 598 0 620 19 598 38 22 38 0 19");
    expect(source).toContain("0 0 620 0 596 38 24 38");
    expect(source).toContain("0 0 620 0 620 38 0 38");
    expect(source).toContain("overlayChargeShapeClip");
    expect(source).toContain("progressEffectShape");
  });

  it("exposes charge bar size controls that change width and height without transform scaling", () => {
    expect(source).toContain("adjustChargeBarSize");
    expect(source).toContain("this.layout.chargeBar");
    expect(source).toContain("Math.max(48");
    expect(source).toContain("Math.max(24");
    expect(source).toContain("this.autoSaveLayout();");
  });
});
