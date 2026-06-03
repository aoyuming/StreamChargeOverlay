import { describe, expect, it } from "vitest";
import {
  SPONSOR_BURST_PARTICLE_COUNT,
  clampParticleDevicePixelRatio
} from "../BurstParticles";

describe("BurstParticles performance limits", () => {
  it("caps high device pixel ratios for the full-stage burst canvas", () => {
    expect(clampParticleDevicePixelRatio(3)).toBe(1.25);
    expect(clampParticleDevicePixelRatio(1)).toBe(1);
  });

  it("keeps sponsor burst particle count bounded for smoother first-frame rendering", () => {
    expect(SPONSOR_BURST_PARTICLE_COUNT).toBeLessThanOrEqual(160);
  });
});
