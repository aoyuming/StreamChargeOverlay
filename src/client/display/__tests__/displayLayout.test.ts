import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("display layout", () => {
  const css = readFileSync(resolve(process.cwd(), "src/client/styles/display.css"), "utf8");

  it("allocates more room to the camera and narrows the current list", () => {
    expect(css).toContain("grid-template-columns: 380px 320px 440px 340px 352px;");
  });

  it("slows the current list while keeping ranking lists slower", () => {
    expect(css).toContain(".program-list.is-scrolling {\n  animation: tickerScroll 28s linear infinite;\n}");
    expect(css).toContain("animation: tickerScroll 32s linear infinite;");
  });
});
