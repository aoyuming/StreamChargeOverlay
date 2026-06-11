import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("overlay layout page", () => {
  const html = readFileSync(resolve(process.cwd(), "overlay.html"), "utf8");
  const css = readFileSync(resolve(process.cwd(), "src/client/styles/overlay.css"), "utf8");
  const main = readFileSync(resolve(process.cwd(), "src/client/overlay-main.ts"), "utf8");
  const cssRule = (selector: string) => {
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = css.indexOf("\n}", start);
    expect(end).toBeGreaterThan(start);
    return css.slice(start, end);
  };

  it("defines a transparent 1920 by 1080 OBS overlay entry", () => {
    expect(html).toContain("<title>直播赞助叠加层</title>");
    expect(html).not.toContain("StreamCharge Overlay 直播叠加层");
    expect(html).toContain('content="width=1920, height=1080, initial-scale=1"');
    expect(html).toContain('class="stream-overlay-shell"');
    expect(html).toContain('data-overlay-stage-width="1920"');
    expect(html).toContain('data-overlay-stage-height="1080"');
    expect(css).toContain("width: 1920px;");
    expect(css).toContain("height: 1080px;");
    expect(css).toContain("background: transparent;");
    expect(main).toContain("width: 1920, height: 1080");
  });

  it("supports desktop capture background modes for live companion windows", () => {
    expect(main).toContain("applyDesktopCaptureBackground(window.location, document.documentElement)");
    expect(main).toContain('captureBg")');
    expect(main).toContain("is-desktop-capture-transparent");
    expect(main).toContain("is-desktop-capture-black");
    expect(main).toContain("is-desktop-capture-green");
    expect(css).toContain("html.is-desktop-capture-transparent");
    expect(css).toContain("background: transparent;");
    expect(css).toContain("html.is-desktop-capture-black");
    expect(css).toContain("background: #000000;");
    expect(css).toContain("html.is-desktop-capture-green");
    expect(css).toContain("background: #00ff00;");
  });

  it("draws a Windows style frame only for desktop capture windows", () => {
    expect(html).toContain('id="desktopCaptureChrome"');
    expect(html).toContain('class="desktop-capture-titlebar"');
    expect(html).toContain('class="desktop-capture-title">StreamCharge直播叠加窗口</span>');
    expect(html).toContain('aria-label="最小化"');
    expect(html).toContain('aria-label="最大化"');
    expect(html).toContain('aria-label="关闭"');
    expect(main).toContain("applyDesktopCaptureChrome(window.location, document.documentElement)");
    expect(main).toContain('captureChrome")');
    expect(main).toContain("is-desktop-capture-chrome");
    expect(css).toContain(".desktop-capture-chrome");
    expect(css).toContain("display: none;");
    expect(css).toContain("html.is-desktop-capture-chrome .desktop-capture-chrome");
    expect(css).toContain("-webkit-app-region: drag;");
    expect(css).toContain(".desktop-capture-window-button");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain("html.is-desktop-capture-chrome .overlay-room-panel");
    expect(css).toContain("top: 50%;");
  });

  it("wires the current list, recent ranking, and charge bar to the existing display app ids", () => {
    expect(html).toContain('data-overlay-widget="todayPrograms"');
    expect(html).toContain('data-overlay-widget="recentRanking"');
    expect(html).toContain('data-overlay-widget="chargeBar"');
    expect(html).toContain('id="currentBossList"');
    expect(html).toContain('id="rankingPinned"');
    expect(html).toContain('id="rankingList"');
    expect(html).toContain('id="progressTrack"');
    expect(html).toContain('id="progressFill"');
    expect(html).toContain('id="progressSlogan"');
    expect(html).toContain('id="progressPercent"');
    expect(html).toContain('id="progressEffectsCanvas"');
    expect(html).toContain('id="burstProgram"');
    expect(html).toContain('id="burstNote"');
    expect(html).toContain('data-progress-effect-mask="overlay-charge"');
    expect(html).toContain("当前大哥节目榜单");
    expect(html).toContain("近两月大哥榜单");
    expect(html).not.toContain(">今日节目榜<");
    expect(html).not.toContain(">近两月榜单<");
  });

  it("supports full edit mode and live hover editing on the production overlay", () => {
    expect(html).toContain('id="overlayEditorToolbar"');
    expect(html).toContain('data-overlay-resize-handle');
    expect(css).toContain("body:not(.is-overlay-editing) .overlay-editor-toolbar");
    expect(css).toContain("body.is-overlay-live-editing [data-overlay-widget].is-widget-editing");
    expect(css).toContain("body.is-overlay-editing [data-overlay-widget]");
    expect(main).toContain("const editor = new OverlayLayoutEditor");
    expect(main).toContain("const fullEditor = OverlayLayoutEditor.isEditing(window.location)");
    expect(main).toContain("editor.start({ fullEditor });");
    expect(main).not.toContain("if (OverlayLayoutEditor.isEditing");
  });

  it("adds an in-overlay room control panel that switches rooms without navigating", () => {
    expect(html).toContain('id="overlayRoomPanel"');
    expect(html).toContain('id="overlayRoomPanelToggle"');
    expect(html).toContain('id="overlayRoomList"');
    expect(html).toContain('id="overlayCopyLayoutParams"');
    expect(html).toContain('id="overlayImportLayoutInput"');
    expect(html).toContain('id="overlayImportLayoutApply"');
    expect(html).toContain('id="overlayResetLayoutParams"');
    expect(html).toContain('class="overlay-widget-editor-controls overlay-charge-inline-tools"');
    expect(html).toContain('id="overlayChargeShapeBeveled"');
    expect(html).toContain('id="overlayChargeShapeTrapezoid"');
    expect(html).toContain('id="overlayChargeShapeRectangle"');
    expect(html).toContain('id="overlayChargeWidthDown"');
    expect(html).toContain('id="overlayChargeWidthUp"');
    expect(html).toContain('id="overlayChargeHeightDown"');
    expect(html).toContain('id="overlayChargeHeightUp"');
    expect(html).toContain('id="overlayChargeSizeLabel"');
    expect(html).not.toContain('class="overlay-charge-tools"');
    expect(html).not.toContain('id="overlayRoomSelect"');
    expect(css).toContain(".overlay-room-panel");
    expect(css).toContain("top: 50%;");
    expect(css).toContain("transform: translateY(-50%) translateX(10px);");
    expect(css).toContain("body.is-overlay-controls-active .overlay-room-panel");
    expect(css).toContain("transform: translateY(-50%) translateX(0);");
    expect(css).toContain("body.is-overlay-controls-active .overlay-room-panel");
    expect(css).toContain(".overlay-room-panel.is-room-panel-open");
    expect(css).toContain(".overlay-layout-tools");
    expect(css).toContain("grid-template-columns: repeat(3, 1fr);");
    expect(css).toContain(".overlay-charge-inline-tools");
    expect(css).toContain(".overlay-charge-shape-actions");
    expect(css).toContain(".overlay-charge-size-actions");
    expect(css).toContain(".overlay-layout-import-input");
    expect(css).toContain("max-height: 168px;");
    expect(css).toContain("body.is-overlay-editing .overlay-room-panel");
    expect(main).toContain("renderOverlayRoomOptions(selectedSlug)");
    expect(main).toContain("preferredRoomSlug(rooms, savedRoomSlug(window.localStorage), roomContext.slug)");
    expect(main).toContain("overlayRoomPanelToggle.addEventListener");
    expect(main).toContain("overlayCopyLayoutParams.addEventListener");
    expect(main).toContain("overlayImportLayoutApply.addEventListener");
    expect(main).toContain("overlayResetLayoutParams.addEventListener");
    expect(main).toContain("bindOverlayChargeTools");
    expect(main).toContain("overlayChargeShapeBeveled.addEventListener");
    expect(main).toContain("overlayChargeShapeTrapezoid.addEventListener");
    expect(main).toContain("overlayChargeShapeRectangle.addEventListener");
    expect(main).toContain("overlayChargeWidthDown.addEventListener");
    expect(main).toContain("overlayChargeWidthUp.addEventListener");
    expect(main).toContain("overlayChargeHeightDown.addEventListener");
    expect(main).toContain("overlayChargeHeightUp.addEventListener");
    expect(main).toContain("editor.setChargeBarShape");
    expect(main).toContain("editor.adjustChargeBarSize");
    expect(main).toContain("refreshChargeBarControls");
    expect(main).toContain("copyOverlayLayoutParams");
    expect(main).toContain("importOverlayLayoutParams");
    expect(main).toContain("resetOverlayLayoutParams");
    expect(main).toContain("editor.resetToDefaultLayout");
    expect(main).toContain("overlayRoomList.replaceChildren");
    expect(main).toContain("is-overlay-controls-active");
    expect(main).toContain("switchOverlayRoom");
    expect(main).not.toContain('window.location.replace(roomPagePath(selectedSlug, "overlay"))');
  });

  it("keeps charge bar width independent from text size and colors the text by progress stage", () => {
    expect(css).toContain("--overlay-charge-bar-font-scale");
    expect(css).toContain(".overlay-recent-ranking {\n  top: var(--overlay-recent-ranking-y, 819px);");
    expect(css).toContain("left: var(--overlay-recent-ranking-x, 1537px);");
    expect(css).toContain("width: var(--overlay-recent-ranking-w, 316px);");
    expect(css).toContain("height: var(--overlay-recent-ranking-h, 250px);");
    expect(css).toContain(".overlay-charge-bar {\n  top: var(--overlay-charge-bar-y, 922px);");
    expect(css).toContain("left: var(--overlay-charge-bar-x, 762px);");
    expect(css).toContain("width: var(--overlay-charge-bar-w, 401px);");
    expect(css).toContain("transform: none;");
    expect(css).toContain("font-size: calc(22px * var(--overlay-charge-bar-font-scale, 1));");
    expect(css).toContain("-webkit-text-stroke");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(132px, auto);");
    expect(css).toContain("padding: 0 10px;");
    const sloganRules = [...css.matchAll(/^\.overlay-charge-bar \.charge-progress-label \{[\s\S]*?\n\}/gm)];
    const percentRules = [...css.matchAll(/^\.overlay-charge-bar \.charge-percent \{[\s\S]*?\n\}/gm)];
    const sloganRule = sloganRules[sloganRules.length - 1]?.[0] ?? "";
    const percentRule = percentRules[percentRules.length - 1]?.[0] ?? "";
    expect(sloganRule).toContain("grid-column: 1;");
    expect(sloganRule).toContain("justify-self: start;");
    expect(sloganRule).toContain("text-align: left;");
    expect(percentRule).toContain("grid-column: 2;");
    expect(percentRule).toContain("justify-self: end;");
    const expectStageTextRule = (stage: string, color: string) => {
      const selector = `.overlay-progress-track.is-${stage} .charge-progress-label`;
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = css.indexOf("\n}", start);
      const rule = css.slice(start, end + 2);
      expect(rule).toContain(`.overlay-progress-track.is-${stage} .charge-percent`);
      expect(rule).toContain(`color: ${color};`);
      expect(rule).toContain("-webkit-text-stroke-color: rgba(0, 0, 0, 0.95);");
    };
    expectStageTextRule("ice", "#ffffff");
    expectStageTextRule("water", "#8fefff");
    expectStageTextRule("steam", "#8fefff");
    expectStageTextRule("fire", "#ffb13b");
    expectStageTextRule("inferno", "#ffb13b");
    expectStageTextRule("lightning", "#ffffff");
  });

  it("styles overlay titles and root-unit amounts with DNF rarity emphasis", () => {
    expect(css).toContain(".overlay-widget-title {\n  height: 26px;");
    expect(css).toContain("font-size: 18px;");
    expect(css).toContain(".amount-rarity-common");
    expect(css).toContain(".amount-rarity-advanced");
    expect(css).toContain(".amount-rarity-rare");
    expect(css).toContain(".amount-rarity-artifact");
    expect(css).toContain(".amount-rarity-legendary");
    expect(css).toContain(".amount-rarity-epic");
    expect(css).toContain(".overlay-current-programs .current-boss-row.has-empty-note .current-boss-program");
    expect(css).toContain(".overlay-current-programs .current-boss-row.has-empty-note .current-boss-amount");
    expect(css).toContain("color: #ffffff;");
    expect(css).toContain("color: #ffe8ad;");
  });

  it("stacks current boss program and note as labeled overlay rows", () => {
    expect(css).toContain(".overlay-current-programs .current-boss-program::before");
    expect(css).toContain('content: "节目:";');
    expect(css).toContain(".overlay-current-programs .current-boss-note::before");
    expect(css).toContain('content: "备注:";');
    expect(css).toContain(".overlay-current-programs .current-boss-program {\n  grid-column: 2 / 4;\n  grid-row: 2;");
    expect(css).toContain(".overlay-current-programs .current-boss-note {\n  grid-column: 2 / 4;\n  grid-row: 3;");
    expect(cssRule(".overlay-current-programs .current-boss-note {")).toContain("text-align: left;");
    expect(css).toContain(".overlay-current-programs .current-boss-row.is-startup-funding .current-boss-program::before");
    expect(css).toContain("content: \"\";");
    expect(css).toContain(".overlay-current-programs .current-boss-row.has-empty-note .current-boss-note {\n  display: none;");
    expect(css).not.toContain(".overlay-current-programs .current-boss-note {\n  grid-column: 3;\n  grid-row: 2;\n  max-width: 96px;");
  });

  it("renders the overlay charge progress bar as a single SVG shape instead of clipped CSS caps", () => {
    expect(html).toContain('class="overlay-charge-svg"');
    expect(html).toContain('class="overlay-charge-shell"');
    expect(html).toContain('class="overlay-charge-fill"');
    expect(html).toContain('class="overlay-charge-frame"');
    expect(html).toContain('data-progress-effect-shape="rectangle"');
    expect(html).toContain('points="0 0 620 0 620 38 0 38"');
    expect(css).toContain(".overlay-charge-svg");
    expect(css).toContain(".overlay-charge-fill");
    expect(css).toContain(".overlay-charge-frame");
    expect(css).toContain("stroke: #000000;");
    expect(css).not.toContain('stroke: url("#overlayChargeFrameGradient")');
    expect(css).not.toContain("--overlay-charge-cap-width");
    expect(css).not.toContain(".overlay-charge-bar::before");
    expect(css).not.toContain(".overlay-progress-track::before");
    expect(css).not.toContain(".overlay-progress-track::after");
    expect(css).not.toContain(".stream-overlay-shell .overlay-progress-track.progress-track::before");
    expect(css).not.toContain(".stream-overlay-shell .overlay-progress-track.progress-track::after");
    expect(css).not.toContain(
      "clip-path: polygon(0 0, 100% 0, calc(100% - var(--overlay-charge-trapezoid-inset)) 100%, var(--overlay-charge-trapezoid-inset) 100%);"
    );
    expect(css).not.toContain("rgba(0, 0, 0, 0.92), rgba(14, 18, 22, 0.6) 48%");
    expect(css).not.toContain("rgba(0, 0, 0, 0.68)");
    expect(css).not.toContain("rgba(0, 0, 0, 0.48)");
  });

  it("uses a light transparent glass trough instead of a dark front segment", () => {
    expect(html).toContain('stop-color="#e9fbff" stop-opacity="0.16"');
    expect(html).toContain('stop-color="#ffffff" stop-opacity="0.08"');
    expect(html).toContain('stop-color="#cfeeff" stop-opacity="0.14"');
    expect(html).not.toContain('stop-color="#152738"');
    expect(html).not.toContain('stop-color="#171c22"');
    expect(html).not.toContain('stop-color="#3a1f18"');
    expect(css).toContain("fill: rgba(235, 250, 255, 0.06);");
    expect(css).toContain("opacity: 0.78;");
    expect(css).toContain("fill: rgba(255, 255, 255, 0.14);");
  });

  it("keeps the full edit toolbar out of normal live mode", () => {
    expect(css).toContain("body:not(.is-overlay-editing) .overlay-editor-toolbar");
    expect(main).toContain("OverlayLayoutEditor");
    expect(main).toContain("loadOverlayLayout");
  });

  it("makes overlay empty-state waiting text warm muted, horizontal, and left aligned", () => {
    expect(css).toContain(".overlay-current-programs .current-boss-row.is-empty");
    expect(css).toContain("color: #d8d2bf;");
    expect(css).toContain("font-size: 22px;");
    expect(css).toContain("justify-content: flex-start;");
    expect(css).toContain("text-align: left;");
    expect(css).toContain(".overlay-recent-ranking .rank-row.is-empty");
    expect(css).toContain("writing-mode: horizontal-tb;");
    expect(css).toContain("white-space: nowrap;");
  });
});
