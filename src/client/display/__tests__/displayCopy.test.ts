import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("display copy", () => {
  it("does not expose sensitive words in the initial display page", () => {
    const html = readFileSync(resolve(process.cwd(), "display.html"), "utf8");

    expect(html).not.toMatch(/赞助|金额|老板|感谢|[¥楼]/);
  });
});
