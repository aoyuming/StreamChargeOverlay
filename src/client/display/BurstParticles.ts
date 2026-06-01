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

// 轻量 Canvas 粒子层：用 z 值做透视缩放，模拟一点 3D 碎片飞出的感觉。
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
  private frameId = 0;
  private devicePixelRatio = 1;

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
    this.resize();

    for (let index = 0; index < 230; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.8 + Math.random() * 14;
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];

      this.particles.push({
        x: origin.x,
        y: origin.y,
        z: -160 + Math.random() * 320,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.62 - Math.random() * 4.6,
        vz: -5 + Math.random() * 10,
        size: 5 + Math.random() * 15,
        life: 72 + Math.random() * 48,
        maxLife: 120,
        rotation: Math.random() * Math.PI,
        spin: -0.2 + Math.random() * 0.4,
        color
      });
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

    this.particles = this.particles.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.z += particle.vz;
      particle.vy += 0.09;
      particle.rotation += particle.spin;
      particle.life -= 1;

      if (particle.life <= 0) {
        return false;
      }

      this.drawParticle(particle);
      return true;
    });

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
    this.context.shadowBlur = 16 * scale;
    this.context.shadowColor = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    this.context.fillRect(-size / 2, -size / 2, size, size);
    this.context.restore();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * this.devicePixelRatio);
    this.canvas.height = Math.round(rect.height * this.devicePixelRatio);
    this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
  }
}
