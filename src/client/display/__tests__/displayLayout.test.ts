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
    expect(displayApp).toContain("this.progressPanel.render(state, state.programQueue)");
  });

  it("labels all current boss columns", () => {
    expect(html).toContain('class="current-boss-header"');
    expect(html).toContain('class="current-boss-header-name">大哥名字</span>');
    expect(html).toContain('class="current-boss-header-program">点的节目</span>');
    expect(html).toContain('class="current-boss-header-note">备注</span>');
    expect(html).not.toContain("实力");
    expect(html).toContain('class="current-boss-header-amount"');
    expect(css).toContain(".current-boss-header");
    expect(css).toContain(".current-boss-header-name");
    expect(css).toContain(".current-boss-header-program");
    expect(css).toContain(".current-boss-header-note");
    expect(css).toContain(".current-boss-header-amount");
  });

  it("uses compact current boss rows instead of clipped hero text", () => {
    expect(css).toContain(".current-boss-row");
    expect(css).toContain(".current-boss-avatar");
    expect(css).toContain(".current-boss-amount");
    expect(css).toContain(".current-boss-note");
    expect(css).toContain(".current-boss-program");
    expect(css).toContain("grid-template-columns: 42px minmax(150px, 1.1fr) minmax(180px, 1fr) minmax(150px, 0.85fr) 120px;");
    expect(css).not.toContain(".current-boss-label");
    expect(css).not.toContain("font-size: 58px;");
  });

  it("adds amount-based current boss row tiers", () => {
    expect(css).toContain(".current-boss-row.is-tier-base");
    expect(css).toContain(".current-boss-row.is-tier-boosted");
    expect(css).toContain(".current-boss-row.is-tier-strong");
    expect(css).toContain(".current-boss-row.is-tier-legend");
  });

  it("gives ranking names more room than the previous narrow layout", () => {
    expect(html).toContain("近两月榜单");
    expect(html).not.toContain("历史大哥总榜单");
    expect(css).toContain("grid-template-columns: 42px 38px minmax(0, 1fr) 112px;");
    expect(css).toContain("grid-template-columns: 50px 46px minmax(0, 1fr) 120px;");
    expect(css).toContain(".rank-avatar");
  });

  it("scrolls the merged current boss ticker slowly", () => {
    expect(css).toContain(".current-boss-list.is-scrolling-slow");
    expect(css).toContain("animation: currentBossScroll var(--current-boss-scroll-duration, 36s) linear infinite;");
  });

  it("keeps the merged charge panel rows inside the bottom HUD height", () => {
    expect(css).toContain(".charge-panel {\n  display: grid;\n  grid-template-rows: 32px 176px 34px 46px;");
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

  it("adds a camera-area room selector and red program-only row styling", () => {
    expect(html).toContain('id="roomSelect"');
    expect(html).toContain('id="roomCycleButton"');
    expect(html).toContain('id="adminOpenButton"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(css).toContain(".room-selector");
    expect(css).toContain(".room-cycle-button");
    expect(css).toContain(".admin-open-button");
    expect(css).not.toContain(".current-boss-row.is-program-only {\n  background:");
    expect(css).toContain(".current-boss-row.is-program-only .current-boss-program");
    expect(readFileSync(resolve(process.cwd(), "src/client/display-main.ts"), "utf8")).toContain(
      'adminOpenButton.href = fixedPagePath("admin")'
    );
    expect(readFileSync(resolve(process.cwd(), "src/client/display-main.ts"), "utf8")).not.toContain(
      "window.location.href = adminUrl"
    );
  });

  it("shows sponsor avatars in current rows, total ranking, and the new sponsor burst", () => {
    const rankingTicker = readFileSync(resolve(process.cwd(), "src/client/display/RankingTicker.ts"), "utf8");
    const progressPanel = readFileSync(resolve(process.cwd(), "src/client/display/ProgressPanel.ts"), "utf8");
    const sponsorBurst = readFileSync(resolve(process.cwd(), "src/client/display/SponsorBurst.ts"), "utf8");

    expect(html).toContain('id="burstAvatar"');
    expect(html).toContain('id="burstProgram"');
    expect(html).toContain('id="burstNote"');
    expect(css).toContain(".burst-avatar");
    expect(css).toContain(".burst-program");
    expect(css).toContain(".burst-note");
    expect(progressPanel).toContain("current-boss-avatar");
    expect(rankingTicker).toContain("rank-avatar");
    expect(sponsorBurst).toContain("avatarElement");
  });

  it("uses an adaptive wide sponsor burst that wraps long program and note text", () => {
    expect(css).toContain("grid-template-columns: 136px minmax(0, auto);");
    expect(css).toContain("min-width: 760px;");
    expect(css).toContain("max-width: min(1500px, calc(100vw - 180px));");
    expect(css).toContain("width: max-content;");
    expect(css).not.toContain("\n  width: 760px;");
    expect(css).toContain("width: 104px;");
    expect(css).toContain("height: 104px;");
    expect(css).toContain("font-size: clamp(38px, 3.2vw, 56px);");
    expect(css).toContain("animation: burstEnter var(--burst-duration, 4200ms) ease forwards;");
    expect(css).toContain(".burst-program,\n.burst-note,\n.sponsor-burst em");
    expect(css).toContain("white-space: normal;");
    expect(css).toContain("-webkit-line-clamp: 2;");
  });

  it("keeps the effect canvas ready for the full 1920 by 1440 stage", () => {
    expect(html).toContain('<canvas id="stageEffectsCanvas" class="stage-effects-canvas" width="1920" height="1440"></canvas>');
    expect(html).toContain('<canvas id="stageShaderEffectsCanvas" class="stage-effects-canvas shader-effects-canvas" width="1920" height="1440"></canvas>');
    expect(html).toContain('<canvas id="burstParticles" class="burst-particles" width="1920" height="1440"></canvas>');
    expect(html).toContain('id="stageEffectStartText"');
    expect(html).toContain(">开始</div>");
    expect(css).toContain(".stage-effects-canvas {\n  position: absolute;\n  inset: 0;\n  z-index: 5;\n  width: 1920px;\n  height: 1440px;");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain(".burst-particles {\n  position: absolute;\n  inset: 0;\n  z-index: 4;\n  width: 1920px;\n  height: 1440px;");
    expect(css).toContain(".stage-effect-start-text");
    expect(css).toContain(".has-dianjiang-effect .stage-effect-start-text");
    expect(displayApp).toContain("has-dianjiang-effect");
    expect(css).toContain("font-size: 210px;");
  });

  it("adds a fit-preview mode for ordinary browser windows", () => {
    expect(css).toContain("html.is-preview-fit,\nhtml.is-preview-fit body");
    expect(css).toContain("left: var(--stage-offset-x);");
    expect(css).toContain("transform: scale(var(--stage-scale));");
  });

  it("slows the current list while keeping ranking lists slower", () => {
    expect(css).toContain("animation: tickerScroll 32s linear infinite;");
  });

  it("keeps progress canvas effects while using shader first for full-stage fire effects", () => {
    expect(html).toContain('id="progressShaderEffectsCanvas"');
    expect(displayApp).not.toContain("ShaderProgressEffectLayer");
    expect(displayApp).toContain('new ProgressEffectLayer(queryRequired("#progressEffectsCanvas"))');
    expect(displayApp).toContain('const canvasStageEffects = new StageEffectLayer(queryRequired("#stageEffectsCanvas"));');
    expect(displayApp).toContain('ShaderStageEffectLayer.create(queryRequired("#stageShaderEffectsCanvas"), canvasStageEffects)');
    expect(displayApp).toContain("?? canvasStageEffects");
  });

  it("can switch overlay data sources without keeping the previous room effects alive", () => {
    expect(displayApp).toContain("switchDataSource");
    expect(displayApp).toContain("this.realtimeClient.disconnect();");
    expect(displayApp).toContain("this.effectCoordinator = new DisplayEffectCoordinator();");
    expect(displayApp).toContain("sourceId");
  });

  it("keeps room changes inside the fixed display page instead of navigating to room URLs", () => {
    const displayMain = readFileSync(resolve(process.cwd(), "src/client/display-main.ts"), "utf8");

    expect(displayMain).toContain("switchDisplayRoom");
    expect(displayMain).toContain("app.switchDataSource(apiClientForRoom(slug), realtimeClientForRoom(slug))");
    expect(displayMain).toContain('adminOpenButton.href = fixedPagePath("admin")');
    expect(displayMain).not.toContain("window.location.replace(roomPagePath");
    expect(displayMain).not.toContain("window.location.href = roomPagePath");
    expect(displayMain).not.toContain('roomPagePath(selectedSlug, "admin")');
  });

  it("includes water, steam, high fire, and enhanced lightning progress styles", () => {
    expect(css).toContain(".progress-track.is-water");
    expect(css).toContain(".progress-track.is-steam");
    expect(css).toContain(".progress-track.is-fire");
    expect(css).toContain(".progress-track.is-fire .progress-fill");
    expect(css).toContain(".progress-track.is-fire::before");
    expect(css).toContain(".progress-track.is-lightning::after");
    expect(css).toContain("animation: lightningFlash");
  });

  it("tones down the brightest white highlights in lightning and high fire progress styles", () => {
    expect(css).not.toContain("rgba(255, 255, 255, 0.9)");
    expect(css).not.toContain("rgba(255, 255, 255, 0.78)");
    expect(css).not.toContain("rgba(255, 255, 230, 0.92)");
  });

  it("keeps high fire flicker controlled and shakes only the charged fill edge", () => {
    expect(css).toContain("animation: highFireFlicker 720ms ease-in-out infinite alternate;");
    expect(css).toContain("animation: highFireHeat 980ms linear infinite;");
    expect(css).toContain("animation: flameRise 760ms ease-in-out infinite alternate;");
    expect(css).toContain(".progress-track.is-fire .progress-fill::before");
    expect(css).toContain("animation: highFireEdgeShake 680ms steps(3, end) infinite;");
    expect(css).toContain("@keyframes highFireEdgeShake");
  });

  it("clips progress track pseudo effects to the charged width", () => {
    expect(css).toContain(".progress-track::before,\n.progress-track::after {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  width: var(--progress, 0%);");
    expect(css).not.toContain(".progress-track::before,\n.progress-track::after {\n  position: absolute;\n  inset: 0;");
    expect(css).toContain("contain: paint;");
    expect(css).toContain("grid-template-rows: 32px 176px 34px 46px;");
    expect(css).toContain("height: 46px;");
    expect(css).not.toContain("0 0 70px rgba(180, 246, 255, 0.34)");
    expect(css).not.toContain("0 0 62px rgba(255, 180, 58, 0.3)");
    expect(css).not.toContain("transform: translateX(-18px) skewX(-8deg);");
    expect(css).not.toContain("transform: translateX(22px) skewX(8deg);");
  });

  it("does not animate the filled width when switching stages so old fire cannot spill into water", () => {
    expect(css).not.toContain("transition: width 420ms ease;");
    expect(css).toContain("transition: filter 220ms ease;");
  });

  it("keeps water caustic animation inside the charged width without horizontal transforms", () => {
    expect(css).not.toContain("transform: translateX(-20px) skewX(-8deg);");
    expect(css).not.toContain("transform: translateX(24px) skewX(8deg);");
    expect(css).toContain("background-position: 42px 0;");
  });
});
