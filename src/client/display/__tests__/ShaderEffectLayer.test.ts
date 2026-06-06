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
      water: 2,
      steam: 3,
      fire: 4,
      inferno: 5,
      lightning: 6,
      dianjiang: 7
    });
  });

  it("contains shader branches for progress stages and dianjiang lightning", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawIce");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawEnergy");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawWater");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawSteam");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawFire");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawLightning");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawDianjiangLightning");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("lightningField");
  });

  it("adds transparent water shader treatment for the new small-fire replacement stage", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("waterCaustics");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("vec3 deepWater");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawWater(v_uv)");
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

  it("parks edge-weighted full-stage masks and applies them only to fire stages", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("stageElementMask");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("stageGlassSweep");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("isFullStage");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("centerRelief");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("fireStageTreatment");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("step(3.5, u_effect) * (1.0 - step(5.5, u_effect))");
  });

  it("boosts inferno, fire, ice, and lightning shader intensity markers", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("STAGE_INFERNO_INTENSITY");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("PROGRESS_EFFECT_BOOST");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("forkedLightningField");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawFire(v_uv, STAGE_INFERNO_INTENSITY)");
  });

  it("keeps dianjiang to lightning only without dragon rings or shader-drawn text", () => {
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("drawDianjiangLightning");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).toContain("dianjiangFlash");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).not.toContain("drawDragonDianjiang");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).not.toContain("dragonBody");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).not.toContain("dianjiangShockwave");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).not.toContain("drawStartGlyph");
    expect(DISPLAY_EFFECT_FRAGMENT_SHADER).not.toContain("startGlyph");
  });

  it("falls back cleanly when WebGL is unavailable", () => {
    const canvas = {
      getContext: () => null
    } as unknown as HTMLCanvasElement;

    expect(ShaderEffectLayer.tryCreate(canvas)).toBeNull();
  });
});
