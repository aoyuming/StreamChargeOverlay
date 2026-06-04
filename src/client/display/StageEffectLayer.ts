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

export interface LightningPoint {
  x: number;
  y: number;
}

export interface LightningBoltOptions {
  amplitude: number;
  endX: number;
  endY: number;
  progress: number;
  seed: number;
  segments: number;
  startX: number;
  startY: number;
}

export interface StageEffectPlayer {
  playSponsorEffect(effect: ProgressEffect): void;
  playDianjiangEffect(): void;
}

export const STAGE_EFFECT_DURATION_MS = 2600;
export const MAX_STAGE_EFFECT_DPR = 1.25;
export const MAX_STAGE_EFFECT_PARTICLES = 240;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const seededNoise = (seed: number) => {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
};

export const buildLightningBoltPoints = (options: LightningBoltOptions): LightningPoint[] => {
  const segmentCount = Math.max(2, Math.round(options.segments));
  const points: LightningPoint[] = [];
  const pulseFrame = Math.floor(options.progress * 18);

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const baseX = options.startX + (options.endX - options.startX) * t;
    const baseY = options.startY + (options.endY - options.startY) * t;

    if (index === 0 || index === segmentCount) {
      points.push({ x: Math.round(baseX), y: Math.round(baseY) });
      continue;
    }

    const jag = seededNoise(options.seed * 97 + index * 31 + pulseFrame * 13) * 2 - 1;
    const wave = Math.sin((t + options.progress) * Math.PI * 5 + options.seed) * 0.34;
    const centerWeight = 1 - Math.abs(t - 0.5) * 0.45;
    const offset = (jag + wave) * options.amplitude * centerWeight;
    points.push({ x: Math.round(baseX + offset), y: Math.round(baseY) });
  }

  return points;
};

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
    this.drawEdgeHeat(width, height, intensity);
    this.drawEdgeFlames(width, height, progress, intensity);
  }

  private drawEdgeHeat(width: number, height: number, intensity: number): void {
    const topHeight = height * (0.12 + intensity * 0.035);
    const bottomHeight = height * (0.18 + intensity * 0.06);
    const sideWidth = width * (0.07 + intensity * 0.025);

    const top = this.context.createLinearGradient(0, 0, 0, topHeight);
    top.addColorStop(0, `rgba(255, 178, 42, ${0.24 * intensity})`);
    top.addColorStop(0.55, `rgba(255, 62, 20, ${0.13 * intensity})`);
    top.addColorStop(1, "rgba(255, 32, 18, 0)");
    this.context.fillStyle = top;
    this.context.fillRect(0, 0, width, topHeight);

    const bottom = this.context.createLinearGradient(0, height, 0, height - bottomHeight);
    bottom.addColorStop(0, `rgba(255, 232, 92, ${0.28 * intensity})`);
    bottom.addColorStop(0.46, `rgba(255, 84, 20, ${0.18 * intensity})`);
    bottom.addColorStop(1, "rgba(255, 32, 18, 0)");
    this.context.fillStyle = bottom;
    this.context.fillRect(0, height - bottomHeight, width, bottomHeight);

    const left = this.context.createLinearGradient(0, 0, sideWidth, 0);
    left.addColorStop(0, `rgba(255, 96, 24, ${0.18 * intensity})`);
    left.addColorStop(0.58, `rgba(255, 184, 60, ${0.1 * intensity})`);
    left.addColorStop(1, "rgba(255, 32, 18, 0)");
    this.context.fillStyle = left;
    this.context.fillRect(0, 0, sideWidth, height);

    const right = this.context.createLinearGradient(width, 0, width - sideWidth, 0);
    right.addColorStop(0, `rgba(255, 96, 24, ${0.18 * intensity})`);
    right.addColorStop(0.58, `rgba(255, 184, 60, ${0.1 * intensity})`);
    right.addColorStop(1, "rgba(255, 32, 18, 0)");
    this.context.fillStyle = right;
    this.context.fillRect(width - sideWidth, 0, sideWidth, height);
  }

  private drawEdgeFlames(width: number, height: number, progress: number, intensity: number): void {
    this.drawHorizontalEdgeFlames(width, height, progress, intensity, "bottom");
    this.drawHorizontalEdgeFlames(width, height, progress, intensity * 0.72, "top");
    this.drawVerticalEdgeFlames(width, height, progress, intensity * 0.68, "left");
    this.drawVerticalEdgeFlames(width, height, progress, intensity * 0.68, "right");
  }

  private drawHorizontalEdgeFlames(
    width: number,
    height: number,
    progress: number,
    intensity: number,
    edge: "top" | "bottom"
  ): void {
    const flameCount = Math.round((edge === "bottom" ? 18 : 13) * intensity);
    const baseY = edge === "bottom" ? height : 0;
    const direction = edge === "bottom" ? -1 : 1;

    for (let index = 0; index < flameCount; index += 1) {
      const left = (width / flameCount) * index;
      const center = left + width / flameCount / 2;
      const flicker = Math.sin(progress * 18 + index * 1.7) * 0.18 + 0.82;
      const flameHeight = height * (edge === "bottom" ? 0.18 : 0.11) * intensity * flicker;
      const flame = this.context.createRadialGradient(center, baseY, 2, center, baseY + direction * flameHeight * 0.45, flameHeight);
      flame.addColorStop(0, "rgba(255, 246, 160, 0.82)");
      flame.addColorStop(0.36, `rgba(255, 120, 26, ${0.42 * intensity})`);
      flame.addColorStop(0.78, `rgba(255, 25, 18, ${0.16 * intensity})`);
      flame.addColorStop(1, "rgba(255, 25, 18, 0)");
      this.context.fillStyle = flame;
      this.context.beginPath();
      this.context.moveTo(left, baseY);
      this.context.quadraticCurveTo(center, baseY + direction * flameHeight, left + width / flameCount, baseY);
      this.context.closePath();
      this.context.fill();
    }
  }

  private drawVerticalEdgeFlames(
    width: number,
    height: number,
    progress: number,
    intensity: number,
    edge: "left" | "right"
  ): void {
    const flameCount = Math.round(10 * intensity);
    const baseX = edge === "left" ? 0 : width;
    const direction = edge === "left" ? 1 : -1;

    for (let index = 0; index < flameCount; index += 1) {
      const top = (height / flameCount) * index;
      const center = top + height / flameCount / 2;
      const flicker = Math.sin(progress * 16 + index * 1.9) * 0.16 + 0.8;
      const flameWidth = width * 0.055 * intensity * flicker;
      const flame = this.context.createRadialGradient(baseX, center, 2, baseX + direction * flameWidth * 0.45, center, flameWidth);
      flame.addColorStop(0, "rgba(255, 232, 128, 0.62)");
      flame.addColorStop(0.46, `rgba(255, 86, 24, ${0.28 * intensity})`);
      flame.addColorStop(1, "rgba(255, 25, 18, 0)");
      this.context.fillStyle = flame;
      this.context.beginPath();
      this.context.moveTo(baseX, top);
      this.context.quadraticCurveTo(baseX + direction * flameWidth, center, baseX, top + height / flameCount);
      this.context.closePath();
      this.context.fill();
    }
  }

  private drawLightning(width: number, height: number, progress: number): void {
    const flash = Math.max(0, Math.sin(progress * Math.PI * 10));
    this.context.fillStyle = `rgba(210, 250, 255, ${0.08 + flash * 0.18})`;
    this.context.fillRect(0, 0, width, height);

    const bolts = [
      { startX: width * 0.1, startY: -30, endX: width * 0.55, endY: height * 0.72, seed: 3 },
      { startX: width * 0.88, startY: -40, endX: width * 0.47, endY: height * 0.65, seed: 9 },
      { startX: width * 0.5, startY: -36, endX: width * 0.67, endY: height * 0.96, seed: 14 },
      { startX: -44, startY: height * 0.22, endX: width * 0.42, endY: height * 0.58, seed: 21 },
      { startX: width + 44, startY: height * 0.3, endX: width * 0.62, endY: height * 0.62, seed: 29 }
    ];

    for (const [index, bolt] of bolts.entries()) {
      const points = buildLightningBoltPoints({
        amplitude: width * (index === 2 ? 0.04 : 0.055),
        endX: bolt.endX,
        endY: bolt.endY,
        progress,
        seed: bolt.seed,
        segments: index === 2 ? 11 : 9,
        startX: bolt.startX,
        startY: bolt.startY
      });

      this.drawLightningPath(points, "rgba(77, 225, 255, 0.46)", index === 2 ? 14 : 11, 46);
      this.drawLightningPath(points, "rgba(255, 255, 255, 0.96)", index === 2 ? 4.4 : 3.4, 20);
      this.drawLightningBranches(points, progress, bolt.seed, width, height);
    }

    this.context.shadowBlur = 0;
  }

  private drawLightningBranches(
    points: LightningPoint[],
    progress: number,
    seed: number,
    width: number,
    height: number
  ): void {
    for (let index = 2; index < points.length - 2; index += 2) {
      const point = points[index];
      const direction = seededNoise(seed * 17 + index * 41) > 0.5 ? 1 : -1;
      const length = width * (0.08 + seededNoise(seed * 43 + index * 19) * 0.08);
      const endX = clamp(point.x + direction * length, -30, width + 30);
      const endY = clamp(point.y + height * (0.03 + seededNoise(seed * 61 + index) * 0.09), -30, height + 30);
      const branch = buildLightningBoltPoints({
        amplitude: width * 0.022,
        endX,
        endY,
        progress,
        seed: seed + index * 7,
        segments: 4,
        startX: point.x,
        startY: point.y
      });

      this.drawLightningPath(branch, "rgba(75, 236, 255, 0.36)", 6, 24);
      this.drawLightningPath(branch, "rgba(255, 255, 255, 0.82)", 2, 12);
    }
  }

  private drawLightningPath(points: LightningPoint[], color: string, lineWidth: number, shadowBlur: number): void {
    const [firstPoint, ...remainingPoints] = points;
    if (!firstPoint) {
      return;
    }

    this.context.strokeStyle = color;
    this.context.lineWidth = lineWidth;
    this.context.shadowBlur = shadowBlur;
    this.context.shadowColor = color;
    this.context.beginPath();
    this.context.moveTo(firstPoint.x, firstPoint.y);
    for (const point of remainingPoints) {
      this.context.lineTo(point.x, point.y);
    }
    this.context.stroke();
  }

  private drawDianjiang(width: number, height: number, progress: number): void {
    const centerX = width / 2;
    const centerY = height * 0.43;
    const flash = Math.max(0, Math.sin(progress * Math.PI * 9));
    const sweep = this.context.createLinearGradient(0, height * 0.18, width, height * 0.82);
    sweep.addColorStop(0, "rgba(46, 234, 255, 0)");
    sweep.addColorStop(0.42, `rgba(46, 234, 255, ${0.22 + flash * 0.22})`);
    sweep.addColorStop(0.5, `rgba(255, 255, 255, ${0.16 + flash * 0.28})`);
    sweep.addColorStop(0.58, `rgba(84, 132, 255, ${0.18 + flash * 0.18})`);
    sweep.addColorStop(1, "rgba(46, 234, 255, 0)");
    this.context.fillStyle = sweep;
    this.context.fillRect(0, 0, width, height);

    this.drawLightning(width, height, progress);
    this.drawDianjiangElectricArcs(width, height, centerX, centerY, progress);
    this.context.shadowBlur = 0;
  }

  private drawDianjiangElectricArcs(
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    progress: number
  ): void {
    const arcTargets = [
      { endX: centerX - width * 0.34, endY: centerY - height * 0.16, seed: 51 },
      { endX: centerX + width * 0.36, endY: centerY + height * 0.12, seed: 67 },
      { endX: centerX - width * 0.2, endY: centerY + height * 0.22, seed: 83 },
      { endX: centerX + width * 0.18, endY: centerY - height * 0.24, seed: 97 }
    ];

    for (const target of arcTargets) {
      const points = buildLightningBoltPoints({
        amplitude: width * 0.025,
        endX: target.endX,
        endY: target.endY,
        progress,
        seed: target.seed,
        segments: 6,
        startX: centerX,
        startY: centerY
      });
      this.drawLightningPath(points, "rgba(46, 234, 255, 0.42)", 8, 30);
      this.drawLightningPath(points, "rgba(237, 255, 255, 0.86)", 2.6, 14);
    }
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
      return ["rgba(46, 234, 255, ALPHA)", "rgba(123, 171, 255, ALPHA)", "rgba(237, 255, 255, ALPHA)"];
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
