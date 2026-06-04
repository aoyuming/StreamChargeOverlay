import { describe, expect, it } from "vitest";
import {
  DISPLAY_EFFECT_FRAGMENT_SHADER,
  EFFECT_UNIFORM_VALUES,
  ShaderEffectLayer
} from "../ShaderEffectLayer";

describe("ShaderEffectLayer", () => {
  it("maps every display effect to a stable shader uniform value", () => {
    expect(EFFECT_UNIFORM_VALUES).toEqual({
      ice: 0,
      energy: 1,
      fire: 2,
      inferno: 3,
      lightning: 4,
      dianjiang: 5
    });
  });

  it("contains shader branches for progress stages and dianjiang electric dragon", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawIce");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawEnergy");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawFire");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawLightning");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawDragonDianjiang");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("dragonBody");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("lightningField");
  });

  it("falls back cleanly when WebGL is unavailable", () => {
    const canvas = {
      getContext: () => null
    } as unknown as HTMLCanvasElement;

    expect(ShaderEffectLayer.tryCreate(canvas)).toBeNull();
  });
});
