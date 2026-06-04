import type { ProgressEffect } from "./ProgressPanel";
import { ShaderEffectLayer } from "./ShaderEffectLayer";
import type { StageEffectPlayer } from "./StageEffectLayer";
import { STAGE_EFFECT_DURATION_MS, MAX_STAGE_EFFECT_DPR } from "./StageEffectLayer";

type ShaderStageEffect = ProgressEffect | "dianjiang";
const FULL_STAGE_WATER_OPACITY = 0.64;
const FULL_STAGE_FIRE_OPACITY = 0.52;

export class ShaderStageEffectLayer implements StageEffectPlayer {
  private frameId = 0;
  private effect: ShaderStageEffect = "ice";
  private startTime: number | undefined;
  private seed = 0;

  private constructor(
    private readonly shader: ShaderEffectLayer,
    private readonly durationMs = STAGE_EFFECT_DURATION_MS,
    private readonly fallback?: StageEffectPlayer
  ) {}

  public static create(canvas: HTMLCanvasElement, fallback?: StageEffectPlayer): ShaderStageEffectLayer | null {
    const shader = ShaderEffectLayer.tryCreate(canvas, MAX_STAGE_EFFECT_DPR);
    return shader ? new ShaderStageEffectLayer(shader, STAGE_EFFECT_DURATION_MS, fallback) : null;
  }

  public playSponsorEffect(effect: ProgressEffect): void {
    if (this.fallback && effect !== "water" && effect !== "fire" && effect !== "inferno") {
      this.stopShader();
      this.fallback.playSponsorEffect(effect);
      return;
    }

    this.play(effect);
  }

  public playDianjiangEffect(): void {
    if (this.fallback) {
      this.stopShader();
      this.fallback.playDianjiangEffect();
      return;
    }

    this.play("dianjiang");
  }

  private play(effect: ShaderStageEffect): void {
    this.effect = effect;
    this.startTime = undefined;
    this.seed = Math.random() * 1000;

    if (this.frameId === 0) {
      this.frameId = window.requestAnimationFrame((time) => this.animate(time));
    }
  }

  private animate(time: number): void {
    if (this.startTime === undefined) {
      this.startTime = time;
    }

    const elapsed = time - this.startTime;
    if (elapsed > this.durationMs) {
      this.shader.clear();
      this.frameId = 0;
      return;
    }

    const progress = Math.max(0, Math.min(1, elapsed / this.durationMs));
    const fade = progress < 0.75 ? 1 : 1 - (progress - 0.75) / 0.25;
    const opacity =
      this.effect === "water"
        ? fade * FULL_STAGE_WATER_OPACITY
        : this.effect === "fire" || this.effect === "inferno"
          ? fade * FULL_STAGE_FIRE_OPACITY
          : fade;
    this.shader.render(this.effect, 100, elapsed, opacity, this.seed);
    this.frameId = window.requestAnimationFrame((nextTime) => this.animate(nextTime));
  }

  private stopShader(): void {
    if (this.frameId !== 0) {
      window.cancelAnimationFrame?.(this.frameId);
      this.frameId = 0;
    }

    this.shader.clear();
    this.startTime = undefined;
  }
}
