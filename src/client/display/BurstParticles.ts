interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
  rotation: number;
  spin: number;
  color: [number, number, number];
}

interface BurstOrigin {
  x: number;
  y: number;
}

export const MAX_PARTICLE_DEVICE_PIXEL_RATIO = 1.25;
export const SPONSOR_BURST_PARTICLE_COUNT = 150;

export const clampParticleDevicePixelRatio = (devicePixelRatio: number): number => {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }

  return Math.min(devicePixelRatio, MAX_PARTICLE_DEVICE_PIXEL_RATIO);
};

export class BurstParticles {
  private readonly context: CanvasRenderingContext2D;
  private readonly colors: Array<[number, number, number]> = [
    [255, 245, 214],
    [122, 202, 192],
    [73, 235, 255],
    [230, 201, 137],
    [199, 154, 85],
    [255, 81, 98],
    [169, 71, 52]
  ];
  private particles: Particle[] = [];
  private readonly particlePool: Particle[] = [];
  private frameId = 0;
  private devicePixelRatio = 1;
  private lastWidth = 0;
  private lastHeight = 0;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("当前浏览器不支持 Canvas 粒子效果");
    }

    this.context = context;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  public explode(origin: BurstOrigin): void {
    this.resizeIfNeeded();

    for (let index = 0; index < SPONSOR_BURST_PARTICLE_COUNT; index += 1) {
      this.particles.push(this.createParticle(origin));
    }

    if (this.frameId === 0) {
      this.frameId = window.requestAnimationFrame(() => this.animate());
    }
  }

  private animate(): void {
    const width = this.canvas.width / this.devicePixelRatio;
    const height = this.canvas.height / this.devicePixelRatio;
    this.context.clearRect(0, 0, width, height);
    this.context.save();
    this.context.globalCompositeOperation = "lighter";

    const liveParticles: Particle[] = [];
    this.particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.z += particle.vz;
      particle.vy += 0.09;
      particle.rotation += particle.spin;
      particle.life -= 1;

      if (particle.life <= 0) {
        this.particlePool.push(particle);
        return;
      }

      this.drawParticle(particle);
      liveParticles.push(particle);
    });
    this.particles = liveParticles;

    this.context.restore();

    if (this.particles.length > 0) {
      this.frameId = window.requestAnimationFrame(() => this.animate());
      return;
    }

    this.frameId = 0;
  }

  private drawParticle(particle: Particle): void {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    const perspective = 520 / (520 + particle.z);
    const scale = Math.max(0.35, Math.min(1.7, perspective));
    const [red, green, blue] = particle.color;
    const size = particle.size * scale;

    this.context.save();
    this.context.translate(particle.x, particle.y);
    this.context.rotate(particle.rotation);
    this.context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    this.context.shadowBlur = 12 * scale;
    this.context.shadowColor = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    this.context.fillRect(-size / 2, -size / 2, size, size);
    this.context.restore();
  }

  private createParticle(origin: BurstOrigin): Particle {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3.8 + Math.random() * 12;
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    const particle = this.particlePool.pop() ?? ({} as Particle);

    particle.x = origin.x;
    particle.y = origin.y;
    particle.z = -140 + Math.random() * 280;
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed * 0.62 - Math.random() * 4.2;
    particle.vz = -4.5 + Math.random() * 9;
    particle.size = 4 + Math.random() * 13;
    particle.life = 66 + Math.random() * 42;
    particle.maxLife = 108;
    particle.rotation = Math.random() * Math.PI;
    particle.spin = -0.18 + Math.random() * 0.36;
    particle.color = color;

    return particle;
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
    this.devicePixelRatio = clampParticleDevicePixelRatio(window.devicePixelRatio || 1);
    this.lastWidth = width;
    this.lastHeight = height;
    this.canvas.width = Math.round(width * this.devicePixelRatio);
    this.canvas.height = Math.round(height * this.devicePixelRatio);
    this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
  }
}
