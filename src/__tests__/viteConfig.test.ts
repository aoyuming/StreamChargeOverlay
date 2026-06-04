import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../vite.config";

describe("vite config", () => {
  it("uses absolute multi-page html inputs so Rollup emits stable file names on Windows", () => {
    const input = config.build?.rollupOptions?.input;

    expect(input).toEqual(
      expect.objectContaining({
        admin: expect.any(String),
        display: expect.any(String)
      })
    );
    expect(isAbsolute((input as Record<string, string>).admin)).toBe(true);
    expect(isAbsolute((input as Record<string, string>).display)).toBe(true);
  });
});
