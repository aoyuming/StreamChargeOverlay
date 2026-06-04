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

  it("uses mist and branching cracks for ice instead of screen-wide stripe bars", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawFrostCracks");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("frostMist");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).not.toContain("vec2(x, 0.05)");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).not.toContain("vec2(x + 0.03, 0.48)");
  });

  it("adds charged edge and rim glow treatment around the active progress shape", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("chargedEdgeMask");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("rimGlow");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("edgeSpark");
  });

  it("boosts inferno, fire, ice, and lightning shader intensity markers", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("STAGE_INFERNO_INTENSITY");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("PROGRESS_EFFECT_BOOST");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("forkedLightningField");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawFire(v_uv, STAGE_INFERNO_INTENSITY)");
  });

  it("draws a stronger dianjiang start signal with a separate start glyph", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawStartGlyph");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("dianjiangShockwave");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("startGlyph");
  });

  it("falls back cleanly when WebGL is unavailable", () => {
    const canvas = {
      getContext: () => null
    } as unknown as HTMLCanvasElement;

    expect(ShaderEffectLayer.tryCreate(canvas)).toBeNull();
  });
});
