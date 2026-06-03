import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("display layout", () => {
  const css = readFileSync(resolve(process.cwd(), "src/client/styles/display.css"), "utf8");
  const html = readFileSync(resolve(process.cwd(), "display.html"), "utf8");

  it("allocates more room to the camera and narrows the current list", () => {
    expect(css).toContain("grid-template-columns: 380px 320px 440px 340px 352px;");
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
    expect(css).toContain(".program-list.is-scrolling {\n  animation: tickerScroll 28s linear infinite;\n}");
    expect(css).toContain("animation: tickerScroll 32s linear infinite;");
  });
});
