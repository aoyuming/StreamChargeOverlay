import type { ProgressEffect, ProgressEffectRenderer } from "./ProgressPanel";

const MAX_EFFECT_DPR = 1.5;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
    this.context.globalCompositeOperation = "lighter";

    if (this.effect === "ice") {
      this.drawIce(width, height, time);
    } else if (this.effect === "fire") {
      this.drawFire(width, height, time);
    } else if (this.effect === "lightning") {
      this.drawLightning(width, height, time);
    } else {
      this.drawEnergy(width, height, time);
    }

    this.context.restore();
    this.frameId = window.requestAnimationFrame((nextTime) => this.animate(nextTime));
  }

  private drawIce(width: number, height: number, time: number): void {
    const progressWidth = width * (this.progressPercent / 100);
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
    const progressWidth = width * (this.progressPercent / 100);
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

  private drawFire(width: number, height: number, time: number): void {
    const progressWidth = width * (this.progressPercent / 100);
    this.spawnFireSparks(progressWidth, height);
    this.drawFlames(progressWidth, height, time);
    this.drawSparks();
  }

  private drawFlames(progressWidth: number, height: number, time: number): void {
    const segments = 12;
    for (let index = 0; index < segments; index += 1) {
      const left = (progressWidth / segments) * index;
      const center = left + progressWidth / segments / 2;
      const flameHeight = height * (0.34 + 0.24 * Math.sin(time / 180 + index * 1.7));
      const gradient = this.context.createRadialGradient(center, height, 1, center, height, flameHeight);
      gradient.addColorStop(0, "rgba(255, 239, 141, 0.75)");
      gradient.addColorStop(0.42, "rgba(255, 97, 28, 0.55)");
      gradient.addColorStop(1, "rgba(255, 36, 20, 0)");
      this.context.fillStyle = gradient;
      this.context.beginPath();
      this.context.moveTo(left, height);
      this.context.quadraticCurveTo(center, height - flameHeight, left + progressWidth / segments, height);
      this.context.closePath();
      this.context.fill();
    }
  }

  private spawnFireSparks(progressWidth: number, height: number): void {
    if (this.sparks.length > 36 || progressWidth <= 0) {
      return;
    }

    for (let index = 0; index < 3; index += 1) {
      this.sparks.push({
        x: Math.random() * progressWidth,
        y: height - 4,
        vx: -0.3 + Math.random() * 0.6,
        vy: -0.8 - Math.random() * 1.8,
        life: 22 + Math.random() * 20,
        maxLife: 42,
        size: 1.5 + Math.random() * 3
      });
    }
  }

  private drawSparks(): void {
    this.sparks = this.sparks.filter((spark) => {
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vy -= 0.01;
      spark.life -= 1;
      if (spark.life <= 0) {
        return false;
      }

      const alpha = spark.life / spark.maxLife;
      this.context.fillStyle = `rgba(255, 220, 98, ${alpha})`;
      this.context.shadowBlur = 12;
      this.context.shadowColor = `rgba(255, 116, 40, ${alpha})`;
      this.context.beginPath();
      this.context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      this.context.fill();
      this.context.shadowBlur = 0;
      return true;
    });
  }

  private drawLightning(width: number, height: number, time: number): void {
    this.drawEnergy(width, height, time);
    const flashes = 2 + Math.floor((time / 170) % 3);
    for (let index = 0; index < flashes; index += 1) {
      const startX = Math.random() * width;
      this.context.strokeStyle = index === 0 ? "rgba(255, 255, 255, 0.95)" : "rgba(105, 243, 255, 0.74)";
      this.context.lineWidth = index === 0 ? 3 : 2;
      this.context.shadowBlur = 20;
      this.context.shadowColor = "rgba(105, 243, 255, 0.95)";
      this.context.beginPath();
      this.context.moveTo(startX, 0);

      let x = startX;
      for (let y = 0; y <= height; y += height / 5) {
        x += -22 + Math.random() * 44;
        this.context.lineTo(clamp(x, 0, width), y);
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
