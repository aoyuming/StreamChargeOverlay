import { describe, expect, it } from "vitest";
import { fitWithinMaxSize } from "../AvatarImageProcessor";

describe("AvatarImageProcessor", () => {
  it.each([
    [800, 400, 200, 100],
    [400, 800, 100, 200],
    [120, 90, 120, 90]
  ])("fits %sx%s images inside 200x200", (width, height, expectedWidth, expectedHeight) => {
    expect(fitWithinMaxSize(width, height, 200)).toEqual({
      width: expectedWidth,
      height: expectedHeight
    });
  });
});
