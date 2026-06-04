import type { ProgressEffect, ProgressEffectRenderer } from "./ProgressPanel";

const MAX_EFFECT_DPR = 1.5;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const flameNoise = (seed: number): number => {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
};

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export class ProgressEffectLayer implements ProgressEffectRenderer {
  private readonly context: CanvasRenderingContext2D;
  private effect: ProgressEffect = "ice";
  private progressPercent = 0;
  private frameId = 0;
  private devicePixelRatio = 1;
  private lastWidth = 0;
  private lastHeight = 0;
  private sparks: Spark[] = [];

  public constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("当前浏览器不支持进度条 Canvas 特效");
    }

    this.context = context;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  public setState(effect: ProgressEffect, progressPercent: number): void {
    this.effect = effect;
    this.progressPercent = clamp(Number.isFinite(progressPercent) ? progressPercent : 0, 0, 100);
    this.resizeIfNeeded();

    if (this.frameId === 0) {
      this.frameId = window.requestAnimationFrame((time) => this.animate(time));
    }
  }

  private animate(time: number): void {
    const width = this.canvas.width / this.devicePixelRatio;
    const height = this.canvas.height / this.devicePixelRatio;
    this.context.clearRect(0, 0, width, height);
    this.context.save();
    this.context.beginPath();
    this.context.rect(0, 0, this.progressWidth(width), height);
    this.context.clip();
    this.context.globalCompositeOperation = "lighter";

    if (this.effect === "ice") {
      this.drawIce(width, height, time);
    } else if (this.effect === "water") {
      this.drawWater(width, height, time);
    } else if (this.effect === "steam") {
      this.drawSteam(width, height, time);
    } else if (this.effect === "fire") {
      this.drawHighFire(width, height, time);
    } else if (this.effect === "inferno") {
      this.drawInferno(width, height, time);
    } else if (this.effect === "lightning") {
      this.drawLightning(width, height, time);
    } else {
      this.drawEnergy(width, height, time);
    }

    this.context.restore();
    this.frameId = window.requestAnimationFrame((nextTime) => this.animate(nextTime));
  }

  private progressWidth(width: number): number {
    return width * (this.progressPercent / 100);
  }

  private drawIce(width: number, height: number, time: number): void {
    const progressWidth = this.progressWidth(width);
    const shimmer = 0.45 + Math.sin(time / 420) * 0.18;
    this.context.strokeStyle = `rgba(190, 245, 255, ${shimmer})`;
    this.context.lineWidth = 1.4;

    for (let index = 0; index < 8; index += 1) {
      const x = (index / 8) * Math.max(progressWidth, width * 0.18) + Math.sin(time / 700 + index) * 10;
      this.context.beginPath();
      this.context.moveTo(x, height * 0.15);
      this.context.lineTo(x + 16, height * 0.48);
      this.context.lineTo(x - 8, height * 0.86);
      this.context.stroke();
    }

    const gradient = this.context.createLinearGradient(0, 0, progressWidth, 0);
    gradient.addColorStop(0, "rgba(70, 180, 255, 0.12)");
    gradient.addColorStop(0.5, "rgba(230, 255, 255, 0.38)");
    gradient.addColorStop(1, "rgba(70, 180, 255, 0.08)");
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, progressWidth, height);
  }

  private drawEnergy(width: number, height: number, time: number): void {
    const progressWidth = this.progressWidth(width);
    const sweepX = ((time / 12) % (width + 160)) - 160;
    const gradient = this.context.createLinearGradient(sweepX, 0, sweepX + 160, 0);
    gradient.addColorStop(0, "rgba(64, 238, 229, 0)");
    gradient.addColorStop(0.45, "rgba(122, 255, 242, 0.7)");
    gradient.addColorStop(1, "rgba(255, 232, 146, 0)");
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, Math.max(progressWidth, 4), height);

    this.context.strokeStyle = "rgba(122, 255, 242, 0.34)";
    this.context.lineWidth = 2;
    for (let line = 0; line < 4; line += 1) {
      const y = height * (0.22 + line * 0.18) + Math.sin(time / 380 + line) * 2.5;
      this.context.beginPath();
      this.context.moveTo(0, y);
      this.context.lineTo(progressWidth, y);
      this.context.stroke();
    }
  }

  private drawWater(width: number, height: number, time: number): void {
    const progressWidth = this.progressWidth(width);
    this.drawWaterBase(progressWidth, height, time, 1);
    this.drawWaterWaves(progressWidth, height, time, 1);
    this.drawWaterBubbles(progressWidth, height, time, 1);
  }

  private drawSteam(width: number, height: number, time: number): void {
    const progressWidth = this.progressWidth(width);
    this.drawWaterBase(progressWidth, height, time, 0.78);
    this.drawWaterWaves(progressWidth, height, time, 0.9);

    const warmEdge = this.context.createLinearGradient(0, 0, progressWidth, 0);
    warmEdge.addColorStop(0, "rgba(54, 222, 255, 0.02)");
    warmEdge.addColorStop(0.72, "rgba(105, 240, 255, 0.14)");
    warmEdge.addColorStop(1, "rgba(255, 126, 54, 0.26)");
    this.context.fillStyle = warmEdge;
    this.context.fillRect(0, 0, Math.max(progressWidth, 4), height);

    this.context.strokeStyle = "rgba(225, 252, 255, 0.32)";
    this.context.lineWidth = 1.7;
    this.context.shadowBlur = 8;
    this.context.shadowColor = "rgba(140, 240, 255, 0.62)";
    for (let index = 0; index < 12; index += 1) {
      const x = ((index * 47 + time * 0.035) % Math.max(progressWidth + 60, 60)) - 30;
      const y = height * (0.24 + (index % 5) * 0.12);
      const drift = Math.sin(time / 540 + index) * 8;
      this.context.beginPath();
      this.context.arc(x + drift, y, 5 + (index % 4) * 2.2, Math.PI * 0.05, Math.PI * 1.45);
      this.context.stroke();
    }
    this.context.shadowBlur = 0;

    this.drawWaterBubbles(progressWidth, height, time + 180, 1.25);
  }

  private drawWaterBase(progressWidth: number, height: number, time: number, intensity: number): void {
    const base = this.context.createLinearGradient(0, 0, Math.max(progressWidth, 4), height);
    base.addColorStop(0, `rgba(2, 44, 74, ${0.16 * intensity})`);
    base.addColorStop(0.42, `rgba(24, 180, 232, ${0.3 * intensity})`);
    base.addColorStop(0.76, `rgba(65, 218, 255, ${0.4 * intensity})`);
    base.addColorStop(1, `rgba(172, 250, 255, ${0.24 * intensity})`);
    this.context.fillStyle = base;
    this.context.fillRect(0, 0, Math.max(progressWidth, 4), height);

    const causticX = ((time / 16) % 180) - 180;
    const caustic = this.context.createLinearGradient(causticX, 0, causticX + 180, 0);
    caustic.addColorStop(0, "rgba(65, 218, 255, 0)");
    caustic.addColorStop(0.4, `rgba(190, 255, 255, ${0.34 * intensity})`);
    caustic.addColorStop(0.56, `rgba(80, 232, 255, ${0.24 * intensity})`);
    caustic.addColorStop(1, "rgba(65, 218, 255, 0)");
    this.context.fillStyle = caustic;
    this.context.fillRect(0, 0, Math.max(progressWidth, 4), height);
  }

  private drawWaterWaves(progressWidth: number, height: number, time: number, intensity: number): void {
    this.context.lineWidth = 1.5 + intensity;
    for (let line = 0; line < 8; line += 1) {
      const y = height * (0.18 + line * 0.1) + Math.sin(time / 420 + line) * 2.6;
      this.context.strokeStyle = line % 2 === 0 ? "rgba(173, 250, 255, 0.4)" : "rgba(65, 218, 255, 0.32)";
      this.context.beginPath();
      this.context.moveTo(0, y);
      for (let x = 0; x <= progressWidth + 38; x += 38) {
        const controlX = x + 19;
        const controlY = y + Math.sin(time / 260 + x / 42 + line * 1.3) * (4.8 + line * 0.22) * intensity;
        this.context.quadraticCurveTo(controlX, controlY, x + 38, y);
      }
      this.context.stroke();
    }
  }

  private drawWaterBubbles(progressWidth: number, height: number, time: number, intensity: number): void {
    this.context.fillStyle = "rgba(188, 252, 255, 0.34)";
    this.context.strokeStyle = "rgba(101, 230, 255, 0.52)";
    this.context.lineWidth = 1.2;
    for (let index = 0; index < Math.round(10 * intensity); index += 1) {
      const cycle = (time / (980 + index * 41) + index * 0.173) % 1;
      const x = (index / Math.max(1, Math.round(10 * intensity))) * Math.max(progressWidth, 12);
      const drift = Math.sin(time / 470 + index * 1.7) * 7;
      const y = height - cycle * height * 0.92;
      const radius = 2.2 + (index % 4) * 1.4;
      this.context.beginPath();
      this.context.arc(clamp(x + drift, 0, progressWidth), y, radius, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
    }
  }

  private drawHighFire(width: number, height: number, time: number): void {
    const progressWidth = this.progressWidth(width);
    this.spawnFireSparks(progressWidth, height, 1.55);
    this.drawInfernoHeat(progressWidth, height, time);
    this.drawFlames(progressWidth, height, time, 1.45);
    this.drawSparks(1.25);
  }

  private drawInferno(width: number, height: number, time: number): void {
    const progressWidth = this.progressWidth(width);
    this.spawnFireSparks(progressWidth, height, 1.9);
    this.drawInfernoHeat(progressWidth, height, time);
    this.drawFlames(progressWidth, height, time, 1.65);
    this.drawSparks(1.45);
  }

  private drawFlames(progressWidth: number, height: number, time: number, intensity: number): void {
    this.drawFlameLayer(progressWidth, height, time, intensity, 0, "outer");
    this.drawFlameLayer(progressWidth, height, time + 140, intensity * 0.82, 11, "middle");
    this.drawFlameLayer(progressWidth, height, time + 260, intensity * 0.58, 23, "inner");
  }

  private drawFlameLayer(
    progressWidth: number,
    height: number,
    time: number,
    intensity: number,
    seedOffset: number,
    layer: "outer" | "middle" | "inner"
  ): void {
    const flameCount = Math.max(4, Math.round((layer === "outer" ? 12 : layer === "middle" ? 16 : 10) * intensity));
    const baseSegment = progressWidth / flameCount;
    const speed = layer === "inner" ? 250 : 390;

    for (let index = 0; index < flameCount; index += 1) {
      const seed = index * 17 + seedOffset;
      const baseLeft = baseSegment * index + (flameNoise(seed) - 0.5) * baseSegment * 0.28;
      const baseWidth = baseSegment * (0.74 + flameNoise(seed + 3) * 0.72);
      const left = clamp(baseLeft, 0, progressWidth);
      const right = clamp(baseLeft + baseWidth, 0, progressWidth);
      const center = (left + right) / 2;
      const sway = Math.sin(time / speed + index * 1.73) * baseSegment * (0.16 + 0.06 * intensity);
      const curl = (flameNoise(seed + Math.floor(time / 180)) - 0.5) * baseSegment * 0.42;
      const heightNoise = 0.58 + flameNoise(seed + 9) * 0.62;
      const flicker = 0.72 + Math.sin(time / (speed * 0.74) + index * 2.2) * 0.22;
      const flameHeight = Math.min(height * 1.04, height * (0.34 + 0.2 * heightNoise) * intensity * flicker);
      const tipX = clamp(center + sway + curl, 0, progressWidth);
      const tipY = height - flameHeight;
      const leftControlX = left + baseWidth * (0.1 + flameNoise(seed + 5) * 0.22);
      const rightControlX = right - baseWidth * (0.1 + flameNoise(seed + 7) * 0.24);
      const leftShoulderY = height - flameHeight * (0.28 + flameNoise(seed + 12) * 0.28);
      const rightShoulderY = height - flameHeight * (0.2 + flameNoise(seed + 14) * 0.32);
      const alpha = layer === "outer" ? 0.24 * intensity : layer === "middle" ? 0.28 * intensity : 0.2 * intensity;
      const warmCore = layer === "inner" ? 0.62 : 0.46;
      const gradient = this.context.createRadialGradient(tipX, tipY + flameHeight * 0.68, 1, tipX, tipY + flameHeight * 0.38, flameHeight);
      gradient.addColorStop(0, `rgba(255, 238, 126, ${Math.min(0.58, warmCore * intensity)})`);
      gradient.addColorStop(0.34, `rgba(255, 126, 28, ${Math.min(0.48, alpha + 0.14)})`);
      gradient.addColorStop(0.72, `rgba(212, 34, 18, ${Math.min(0.32, alpha)})`);
      gradient.addColorStop(1, "rgba(255, 38, 18, 0)");

      this.context.fillStyle = gradient;
      this.context.beginPath();
      this.context.moveTo(left, height);
      this.context.bezierCurveTo(leftControlX, leftShoulderY, tipX - baseWidth * 0.42, tipY + flameHeight * 0.16, tipX, tipY);
      this.context.bezierCurveTo(tipX + baseWidth * 0.34, tipY + flameHeight * 0.2, rightControlX, rightShoulderY, right, height);
      this.context.closePath();
      this.context.fill();
    }
  }

  private drawInfernoHeat(progressWidth: number, height: number, time: number): void {
    const heatX = ((time / 18) % 140) - 140;
    const gradient = this.context.createLinearGradient(heatX, 0, heatX + 140, 0);
    gradient.addColorStop(0, "rgba(255, 54, 18, 0)");
    gradient.addColorStop(0.34, "rgba(255, 223, 96, 0.36)");
    gradient.addColorStop(0.62, "rgba(255, 84, 20, 0.32)");
    gradient.addColorStop(1, "rgba(255, 54, 18, 0)");
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, Math.max(progressWidth, 4), height);

    this.context.strokeStyle = "rgba(255, 188, 64, 0.26)";
    this.context.lineWidth = 2.4;
    for (let line = 0; line < 5; line += 1) {
      const y = height * (0.18 + line * 0.16);
      this.context.beginPath();
      for (let x = 0; x <= progressWidth; x += 28) {
        const waveY = y + Math.sin(time / 190 + x / 46 + line) * 4.5;
        if (x === 0) {
          this.context.moveTo(x, waveY);
        } else {
          this.context.lineTo(x, waveY);
        }
      }
      this.context.stroke();
    }
  }

  private spawnFireSparks(progressWidth: number, height: number, intensity: number): void {
    const maxSparks = Math.round(36 * intensity);
    if (this.sparks.length > maxSparks || progressWidth <= 0) {
      return;
    }

    const sparkCount = Math.ceil(3 * intensity);
    for (let index = 0; index < sparkCount; index += 1) {
      this.sparks.push({
        x: Math.random() * progressWidth,
        y: height - 4,
        vx: -0.4 * intensity + Math.random() * 0.8 * intensity,
        vy: -0.9 - Math.random() * 2.1 * intensity,
        life: 22 + Math.random() * 20,
        maxLife: 42,
        size: 1.5 + Math.random() * 2.6 * intensity
      });
    }
  }

  private drawSparks(intensity: number): void {
    this.sparks = this.sparks.filter((spark) => {
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vy -= 0.01;
      spark.life -= 1;
      if (spark.life <= 0) {
        return false;
      }

      const alpha = spark.life / spark.maxLife;
      this.context.fillStyle = `rgba(255, 225, 98, ${Math.min(1, alpha * intensity)})`;
      this.context.shadowBlur = 12 * intensity;
      this.context.shadowColor = `rgba(255, 88, 28, ${Math.min(1, alpha * intensity)})`;
      this.context.beginPath();
      this.context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      this.context.fill();
      this.context.shadowBlur = 0;
      return true;
    });
  }

  private drawLightning(width: number, height: number, time: number): void {
    this.drawEnergy(width, height, time);
    this.context.fillStyle = `rgba(210, 252, 255, ${0.04 + Math.abs(Math.sin(time / 90)) * 0.08})`;
    this.context.fillRect(0, 0, width, height);

    const flashes = 4 + Math.floor((time / 130) % 4);
    for (let index = 0; index < flashes; index += 1) {
      const startX = Math.random() * width;
      this.context.strokeStyle = index === 0 ? "rgba(255, 255, 255, 0.78)" : "rgba(105, 243, 255, 0.62)";
      this.context.lineWidth = index === 0 ? 4 : 2.4;
      this.context.shadowBlur = 22;
      this.context.shadowColor = "rgba(105, 243, 255, 0.95)";
      this.context.beginPath();
      this.context.moveTo(startX, 0);

      let x = startX;
      for (let y = 0; y <= height; y += height / 5) {
        x += -22 + Math.random() * 44;
        this.context.lineTo(clamp(x, 0, width), y);

        if (Math.random() > 0.46) {
          const branchLength = 20 + Math.random() * 42;
          const branchDirection = Math.random() > 0.5 ? 1 : -1;
          this.context.moveTo(clamp(x, 0, width), y);
          this.context.lineTo(clamp(x + branchLength * branchDirection, 0, width), clamp(y + 8 + Math.random() * 16, 0, height));
          this.context.moveTo(clamp(x, 0, width), y);
        }
      }

      this.context.stroke();
    }
    this.context.shadowBlur = 0;
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
    this.devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_EFFECT_DPR);
    this.lastWidth = width;
    this.lastHeight = height;
    this.canvas.width = Math.round(width * this.devicePixelRatio);
    this.canvas.height = Math.round(height * this.devicePixelRatio);
    this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
  }
}
