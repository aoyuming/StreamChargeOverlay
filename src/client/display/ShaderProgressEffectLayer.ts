import type { ProgressEffect, ProgressEffectRenderer } from "./ProgressPanel";
import { ShaderEffectLayer } from "./ShaderEffectLayer";

const MAX_PROGRESS_SHADER_DPR = 1.5;

export class ShaderProgressEffectLayer implements ProgressEffectRenderer {
  private effect: ProgressEffect = "ice";
  private progressPercent = 0;
  private frameId = 0;
  private seed = Math.random() * 1000;

  private constructor(private readonly shader: ShaderEffectLayer) {}

  public static create(canvas: HTMLCanvasElement): ShaderProgressEffectLayer | null {
    const shader = ShaderEffectLayer.tryCreate(canvas, MAX_PROGRESS_SHADER_DPR);
    return shader ? new ShaderProgressEffectLayer(shader) : null;
  }

  public setState(effect: ProgressEffect, progressPercent: number): void {
    this.effect = effect;
    this.progressPercent = Math.max(0, Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0));

    if (this.frameId === 0) {
      this.frameId = window.requestAnimationFrame((time) => this.animate(time));
    }
  }

  private animate(time: number): void {
    this.shader.render(this.effect, this.progressPercent, time, 1, this.seed);
    this.frameId = window.requestAnimationFrame((nextTime) => this.animate(nextTime));
  }
}
