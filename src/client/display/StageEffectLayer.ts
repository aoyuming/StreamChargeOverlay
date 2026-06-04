import type { ProgressEffect } from "./ProgressPanel";

type StageEffect = ProgressEffect | "dianjiang";

interface StageParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface StageEffectPlayer {
  playSponsorEffect(effect: ProgressEffect): void;
  playDianjiangEffect(): void;
}

export const STAGE_EFFECT_DURATION_MS = 2600;
export const MAX_STAGE_EFFECT_DPR = 1.25;
export const MAX_STAGE_EFFECT_PARTICLES = 240;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampStageEffectDevicePixelRatio = (devicePixelRatio: number): number => {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }

  return Math.min(devicePixelRatio, MAX_STAGE_EFFECT_DPR);
};

export class StageEffectLayer implements StageEffectPlayer {
  private readonly context: CanvasRenderingContext2D;
  private effect: StageEffect = "ice";
  private frameId = 0;
  private devicePixelRatio = 1;
  private lastWidth = 0;
  private lastHeight = 0;
  private startTime: number | undefined;
  private particles: StageParticle[] = [];

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly durationMs = STAGE_EFFECT_DURATION_MS
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Full-stage canvas effects are not supported by this browser");
    }

    this.context = context;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  public playSponsorEffect(effect: ProgressEffect): void {
    this.play(effect);
  }

  public playDianjiangEffect(): void {
    this.play("dianjiang");
  }

  private play(effect: StageEffect): void {
    this.effect = effect;
    this.startTime = undefined;
    this.particles = [];
    this.seedParticles(effect);
    this.resizeIfNeeded();

    if (this.frameId === 0) {
      this.frameId = window.requestAnimationFrame((time) => this.animate(time));
    }
  }

  private animate(time: number): void {
    if (this.startTime === undefined) {
      this.startTime = time;
    }

    const elapsed = time - this.startTime;
    const width = this.canvas.width / this.devicePixelRatio;
    const height = this.canvas.height / this.devicePixelRatio;

    if (elapsed > this.durationMs) {
      this.clear(width, height);
      this.frameId = 0;
      return;
    }

    const progress = clamp(elapsed / this.durationMs, 0, 1);
    const fade = progress < 0.75 ? 1 : 1 - (progress - 0.75) / 0.25;
    this.clear(width, height);
    this.context.save();
    this.context.globalAlpha = fade;
    this.context.globalCompositeOperation = "lighter";

    if (this.effect === "ice") {
      this.drawIce(width, height, progress);
    } else if (this.effect === "fire") {
      this.drawFire(width, height, progress, 1);
    } else if (this.effect === "inferno") {
      this.drawFire(width, height, progress, 1.65);
    } else if (this.effect === "lightning") {
      this.drawLightning(width, height, progress);
    } else {
      this.drawDianjiang(width, height, progress);
    }

    this.drawParticles(progress);
    this.context.restore();
    this.frameId = window.requestAnimationFrame((nextTime) => this.animate(nextTime));
  }

  private drawIce(width: number, height: number, progress: number): void {
    const frost = this.context.createLinearGradient(0, 0, width, height);
    frost.addColorStop(0, "rgba(35, 170, 255, 0.04)");
    frost.addColorStop(0.5, "rgba(206, 250, 255, 0.18)");
    frost.addColorStop(1, "rgba(95, 215, 255, 0.05)");
    this.context.fillStyle = frost;
    this.context.fillRect(0, 0, width, height);

    this.context.strokeStyle = "rgba(190, 248, 255, 0.84)";
    this.context.lineWidth = 2.2;
    this.context.shadowBlur = 18;
    this.context.shadowColor = "rgba(95, 220, 255, 0.9)";
    for (let index = 0; index < 16; index += 1) {
      const x = (width / 15) * index;
      const rootY = height * (0.1 + ((index * 37) % 70) / 100);
      const reach = 90 + 130 * Math.sin(progress * Math.PI + index);
      this.context.beginPath();
      this.context.moveTo(x, rootY);
      this.context.lineTo(x + Math.sin(index) * 60, rootY + reach);
      this.context.lineTo(x - Math.cos(index) * 42, rootY + reach * 1.45);
      this.context.stroke();
    }
    this.context.shadowBlur = 0;
  }

  private drawFire(width: number, height: number, progress: number, intensity: number): void {
    const heat = this.context.createRadialGradient(width / 2, height, 1, width / 2, height, height * 0.9);
    heat.addColorStop(0, `rgba(255, 232, 92, ${0.28 * intensity})`);
    heat.addColorStop(0.28, `rgba(255, 84, 20, ${0.2 * intensity})`);
    heat.addColorStop(1, "rgba(255, 32, 18, 0)");
    this.context.fillStyle = heat;
    this.context.fillRect(0, 0, width, height);

    const flameCount = Math.round(18 * intensity);
    for (let index = 0; index < flameCount; index += 1) {
      const left = (width / flameCount) * index;
      const center = left + width / flameCount / 2;
      const flicker = Math.sin(progress * 18 + index * 1.7) * 0.18 + 0.82;
      const flameHeight = height * (0.22 + 0.18 * intensity) * flicker;
      const flame = this.context.createRadialGradient(center, height, 2, center, height - flameHeight * 0.45, flameHeight);
      flame.addColorStop(0, "rgba(255, 246, 160, 0.9)");
      flame.addColorStop(0.36, `rgba(255, 120, 26, ${0.68 * intensity})`);
      flame.addColorStop(0.78, `rgba(255, 25, 18, ${0.22 * intensity})`);
      flame.addColorStop(1, "rgba(255, 25, 18, 0)");
      this.context.fillStyle = flame;
      this.context.beginPath();
      this.context.moveTo(left, height);
      this.context.quadraticCurveTo(center, height - flameHeight, left + width / flameCount, height);
      this.context.closePath();
      this.context.fill();
    }
  }

  private drawLightning(width: number, height: number, progress: number): void {
    this.context.fillStyle = `rgba(210, 250, 255, ${0.12 + Math.sin(progress * Math.PI * 12) * 0.08})`;
    this.context.fillRect(0, 0, width, height);
    this.context.strokeStyle = "rgba(255, 255, 255, 0.95)";
    this.context.lineWidth = 4;
    this.context.shadowBlur = 36;
    this.context.shadowColor = "rgba(98, 238, 255, 1)";

    for (let bolt = 0; bolt < 6; bolt += 1) {
      let x = width * ((bolt + 0.7) / 6) + Math.sin(progress * 20 + bolt) * 110;
      this.context.beginPath();
      this.context.moveTo(x, 0);
      for (let y = 0; y <= height; y += height / 8) {
        x = clamp(x + Math.sin(progress * 42 + y + bolt) * 58, 0, width);
        this.context.lineTo(x, y);
        if (bolt % 2 === 0) {
          this.context.moveTo(x, y);
          this.context.lineTo(clamp(x + 70 * (bolt % 3 === 0 ? 1 : -1), 0, width), clamp(y + 36, 0, height));
          this.context.moveTo(x, y);
        }
      }
      this.context.stroke();
    }
    this.context.shadowBlur = 0;
  }

  private drawDianjiang(width: number, height: number, progress: number): void {
    const centerX = width / 2;
    const centerY = height * 0.43;
    const ringRadius = 120 + progress * 720;
    const glow = this.context.createRadialGradient(centerX, centerY, 1, centerX, centerY, ringRadius);
    glow.addColorStop(0, "rgba(255, 246, 176, 0.72)");
    glow.addColorStop(0.35, "rgba(255, 184, 54, 0.24)");
    glow.addColorStop(1, "rgba(255, 120, 36, 0)");
    this.context.fillStyle = glow;
    this.context.fillRect(0, 0, width, height);

    this.context.strokeStyle = "rgba(255, 238, 142, 0.94)";
    this.context.lineWidth = 6;
    this.context.shadowBlur = 38;
    this.context.shadowColor = "rgba(255, 213, 82, 1)";
    for (let index = 0; index < 3; index += 1) {
      this.context.beginPath();
      this.context.arc(centerX, centerY, ringRadius * (0.28 + index * 0.22), 0, Math.PI * 2);
      this.context.stroke();
    }

    this.context.lineWidth = 3;
    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18 + progress * 2.2;
      const start = 80 + progress * 90;
      const end = 360 + progress * 540;
      this.context.beginPath();
      this.context.moveTo(centerX + Math.cos(angle) * start, centerY + Math.sin(angle) * start);
      this.context.lineTo(centerX + Math.cos(angle) * end, centerY + Math.sin(angle) * end);
      this.context.stroke();
    }
    this.context.shadowBlur = 0;
  }

  private seedParticles(effect: StageEffect): void {
    const palette = this.paletteFor(effect);
    const count = effect === "dianjiang" ? 170 : effect === "inferno" || effect === "lightning" ? 210 : 150;
    const width = this.canvas.width / this.devicePixelRatio;
    const height = this.canvas.height / this.devicePixelRatio;

    for (let index = 0; index < Math.min(count, MAX_STAGE_EFFECT_PARTICLES); index += 1) {
      const fromCenter = effect === "dianjiang";
      const angle = Math.random() * Math.PI * 2;
      const speed = fromCenter ? 4 + Math.random() * 11 : 1.8 + Math.random() * 6.8;
      this.particles.push({
        x: fromCenter ? width / 2 : Math.random() * width,
        y: fromCenter ? height * 0.43 : effect === "ice" || effect === "lightning" ? Math.random() * height : height,
        vx: Math.cos(angle) * speed,
        vy: fromCenter ? Math.sin(angle) * speed : -speed * (0.35 + Math.random()),
        life: 60 + Math.random() * 70,
        maxLife: 130,
        size: 2 + Math.random() * (effect === "inferno" ? 8 : 5),
        color: palette[index % palette.length]
      });
    }
  }

  private drawParticles(progress: number): void {
    this.particles = this.particles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += this.effect === "ice" ? 0.012 : 0.035;
      particle.life -= 1;

      if (particle.life <= 0) {
        return false;
      }

      const alpha = Math.max(0, (particle.life / particle.maxLife) * (1 - progress * 0.35));
      this.context.fillStyle = particle.color.replace("ALPHA", alpha.toFixed(3));
      this.context.shadowBlur = 18;
      this.context.shadowColor = this.context.fillStyle;
      this.context.beginPath();
      this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.context.fill();
      this.context.shadowBlur = 0;
      return true;
    });
  }

  private paletteFor(effect: StageEffect): string[] {
    if (effect === "ice") {
      return ["rgba(185, 248, 255, ALPHA)", "rgba(88, 206, 255, ALPHA)", "rgba(255, 255, 255, ALPHA)"];
    }

    if (effect === "lightning") {
      return ["rgba(255, 255, 255, ALPHA)", "rgba(102, 244, 255, ALPHA)", "rgba(158, 178, 255, ALPHA)"];
    }

    if (effect === "dianjiang") {
      return ["rgba(255, 245, 166, ALPHA)", "rgba(255, 184, 64, ALPHA)", "rgba(110, 245, 255, ALPHA)"];
    }

    return ["rgba(255, 238, 128, ALPHA)", "rgba(255, 107, 26, ALPHA)", "rgba(255, 32, 18, ALPHA)"];
  }

  private clear(width: number, height: number): void {
    this.context.clearRect(0, 0, width, height);
  }

  private resizeIfNeeded(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (Math.round(rect.width) !== this.lastWidth || Math.round(rect.height) !== this.lastHeight) {
      this.resize();
    }
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.width));
    const height = Math.max(1, Math.round(rect.height || this.canvas.height));
    this.devicePixelRatio = clampStageEffectDevicePixelRatio(window.devicePixelRatio || 1);
    this.lastWidth = width;
    this.lastHeight = height;
    this.canvas.width = Math.round(width * this.devicePixelRatio);
    this.canvas.height = Math.round(height * this.devicePixelRatio);
    this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
  }
}
