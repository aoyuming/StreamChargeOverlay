import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("display layout", () => {
  const css = readFileSync(resolve(process.cwd(), "src/client/styles/display.css"), "utf8");
  const html = readFileSync(resolve(process.cwd(), "display.html"), "utf8");

  it("merges current sponsor and progress into a wider charge panel", () => {
    expect(css).toContain("grid-template-columns: 380px 660px 390px 416px;");
    expect(html).toContain('class="panel charge-panel"');
    expect(html).toContain('id="currentBossList"');
    expect(html).toContain('id="progressSlogan"');
    expect(html).toContain('id="progressEffectsCanvas"');
    expect(html).not.toContain('class="panel program-panel"');
    expect(html).not.toContain('id="programList"');
  });

  it("uses compact current boss rows instead of clipped hero text", () => {
    expect(css).toContain(".current-boss-row");
    expect(css).toContain(".current-boss-amount");
    expect(css).toContain(".current-boss-note");
    expect(css).toContain(".current-boss-program");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(88px, 132px) 106px;");
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

  it("clips the current boss list above the progress percentage without showing a partial row", () => {
    expect(css).toContain(".current-boss-viewport {\n  position: relative;\n  z-index: 1;\n  height: 160px;");
    expect(css).toContain("max-width: calc(100% - 150px);");
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
});
