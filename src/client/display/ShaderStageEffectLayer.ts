import type { ProgressEffect } from "./ProgressPanel";
import { ShaderEffectLayer } from "./ShaderEffectLayer";
import type { StageEffectPlayer } from "./StageEffectLayer";
import { STAGE_EFFECT_DURATION_MS, MAX_STAGE_EFFECT_DPR } from "./StageEffectLayer";

type ShaderStageEffect = ProgressEffect | "dianjiang";

export class ShaderStageEffectLayer implements StageEffectPlayer {
  private frameId = 0;
  private effect: ShaderStageEffect = "ice";
  private startTime: number | undefined;
  private seed = 0;

  private constructor(
    private readonly shader: ShaderEffectLayer,
    private readonly durationMs = STAGE_EFFECT_DURATION_MS
  ) {}

  public static create(canvas: HTMLCanvasElement): ShaderStageEffectLayer | null {
    const shader = ShaderEffectLayer.tryCreate(canvas, MAX_STAGE_EFFECT_DPR);
    return shader ? new ShaderStageEffectLayer(shader) : null;
  }

  public playSponsorEffect(effect: ProgressEffect): void {
    this.play(effect);
  }

  public playDianjiangEffect(): void {
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
    this.shader.render(this.effect, 100, elapsed, fade, this.seed);
    this.frameId = window.requestAnimationFrame((nextTime) => this.animate(nextTime));
  }
}
