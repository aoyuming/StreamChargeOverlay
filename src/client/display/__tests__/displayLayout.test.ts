import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("display layout", () => {
  const css = readFileSync(resolve(process.cwd(), "src/client/styles/display.css"), "utf8");
  const displayApp = readFileSync(resolve(process.cwd(), "src/client/display/DisplayApp.ts"), "utf8");
  const html = readFileSync(resolve(process.cwd(), "display.html"), "utf8");

  it("removes the today ranking panel and splits its width into charge and total ranking panels", () => {
    expect(css).toContain("grid-template-columns: 380px 862px 618px;");
    expect(html).toContain('class="panel charge-panel"');
    expect(html).toContain("今日大哥节目榜单");
    expect(html).toContain('id="currentBossList"');
    expect(html).toContain('id="progressSlogan"');
    expect(html).toContain('id="progressEffectsCanvas"');
    expect(html).not.toContain("今日大哥榜单");
    expect(html).not.toContain('class="panel today-ranking-panel"');
    expect(html).not.toContain("todayRankingPinned");
    expect(html).not.toContain("todayRankingList");
    expect(html).not.toContain('class="panel program-panel"');
    expect(html).not.toContain('id="programList"');
    expect(displayApp).not.toContain("TodayRankingTicker");
    expect(displayApp).not.toContain("buildTodayRanking");
    expect(displayApp).not.toContain("todayRanking");
  });

  it("labels the current boss note and amount columns", () => {
    expect(html).toContain('class="current-boss-header"');
    expect(html).toContain('class="current-boss-header-note">备注</span>');
    expect(html).toContain('class="current-boss-header-amount">实力</span>');
    expect(css).toContain(".current-boss-header");
    expect(css).toContain(".current-boss-header-note");
    expect(css).toContain(".current-boss-header-amount");
  });

  it("uses compact current boss rows instead of clipped hero text", () => {
    expect(css).toContain(".current-boss-row");
    expect(css).toContain(".current-boss-amount");
    expect(css).toContain(".current-boss-note");
    expect(css).toContain(".current-boss-program");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(120px, 190px) 120px;");
    expect(css).not.toContain(".current-boss-label");
    expect(css).not.toContain("font-size: 58px;");
  });

  it("gives ranking names more room than the previous narrow layout", () => {
    expect(css).toContain("grid-template-columns: 42px minmax(0, 1fr) 112px;");
    expect(css).toContain("grid-template-columns: 50px minmax(0, 1fr) 120px;");
  });

  it("scrolls the merged current boss ticker slowly", () => {
    expect(css).toContain(".current-boss-list.is-scrolling-slow");
    expect(css).toContain("animation: currentBossScroll var(--current-boss-scroll-duration, 36s) linear infinite;");
  });

  it("keeps the merged charge panel rows inside the bottom HUD height", () => {
    expect(css).toContain(".charge-panel {\n  display: grid;\n  grid-template-rows: 32px 176px 36px 50px;");
    expect(css).toContain("gap: 4px;");
    expect(css).toContain("padding: 12px 16px 4px;");
  });

  it("clips the current boss list above the charge summary without showing a partial row", () => {
    expect(css).toContain(".current-boss-viewport {\n  position: relative;\n  z-index: 1;\n  height: 143px;");
    expect(css).toContain("gap: 16px;");
    expect(css).toContain("flex: 1 1 0;");
    expect(css).toContain("white-space: nowrap;");
    expect(css).toContain(".charge-progress-row {\n  position: relative;\n  z-index: 3;");
  });

  it("uses a 1920 by 1440 transparent stage with the existing HUD docked at the bottom", () => {
    expect(html).toContain('content="width=1920, height=1440, initial-scale=1"');
    expect(css).toContain("height: 1440px;");
    expect(css).toContain("grid-template-rows: 328px;");
    expect(css).toContain("align-content: end;");
    expect(css).toContain(".overlay-shell::before {\n  inset: auto 0 0 0;\n  height: 360px;");
  });

  it("keeps the effect canvas ready for the full 1920 by 1440 stage", () => {
    expect(html).toContain('<canvas id="burstParticles" class="burst-particles" width="1920" height="1440"></canvas>');
    expect(css).toContain(".burst-particles {\n  position: absolute;\n  inset: 0;\n  z-index: 4;\n  width: 1920px;\n  height: 1440px;");
  });

  it("adds a fit-preview mode for ordinary browser windows", () => {
    expect(css).toContain("html.is-preview-fit,\nhtml.is-preview-fit body");
    expect(css).toContain("left: var(--stage-offset-x);");
    expect(css).toContain("transform: scale(var(--stage-scale));");
  });

  it("slows the current list while keeping ranking lists slower", () => {
    expect(css).toContain("animation: tickerScroll 32s linear infinite;");
  });

  it("includes stronger fire and enhanced lightning progress styles", () => {
    expect(css).toContain(".progress-track.is-inferno");
    expect(css).toContain(".progress-track.is-inferno .progress-fill");
    expect(css).toContain(".progress-track.is-inferno::before");
    expect(css).toContain(".progress-track.is-lightning::after");
    expect(css).toContain("animation: lightningFlash");
  });

  it("clips progress track pseudo effects to the charged width", () => {
    expect(css).toContain(".progress-track::before,\n.progress-track::after {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  width: var(--progress, 0%);");
    expect(css).not.toContain(".progress-track::before,\n.progress-track::after {\n  position: absolute;\n  inset: 0;");
  });
});
