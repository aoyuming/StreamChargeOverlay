import { describe, expect, it } from "vitest";
import {
  buildRootUnitActionText,
  buildRootUnitSpeechText,
  formatDisplayName,
  formatRootUnits,
  neutralizePublicText
} from "../displayUnits";

describe("displayUnits", () => {
  it("formats raw amount values as root units without money symbols", () => {
    expect(formatRootUnits(100)).toBe("1根");
    expect(formatRootUnits(188)).toBe("1.88根");
    expect(formatRootUnits(500)).toBe("5根");
  });

  it("builds neutral action text without sensitive terms", () => {
    const text = buildRootUnitActionText("张三", 188);

    expect(text).toBe("张三大哥 点亮 1.88根");
    expect(text).not.toMatch(/感谢|赞助|金额|老板|[¥楼]/);
  });

  it("neutralizes names and speech text for public output", () => {
    expect(formatDisplayName("赛丽亚老板")).toBe("赛丽亚大哥");
    expect(buildRootUnitActionText("张三大哥", 100)).toBe("张三大哥 点亮 1根");
    expect(buildRootUnitSpeechText("张三", 188, "感谢老板安排")).toBe("张三大哥，点亮 1.88根，大哥安排");
    expect(neutralizePublicText("感谢老板赞助金额¥188")).toBe("大哥点亮进度188");
  });
});
