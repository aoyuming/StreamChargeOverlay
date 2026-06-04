import type { ProgressEffect } from "./ProgressPanel";

export type ShaderDisplayEffect = ProgressEffect | "dianjiang";

export const EFFECT_UNIFORM_VALUES: Record<ShaderDisplayEffect, number> = {
  ice: 0,
  energy: 1,
  fire: 2,
  inferno: 3,
  lightning: 4,
  dianjiang: 5
};

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const DISPLAY_EFFECT_FRAGMENT_SHADER = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_progress;
uniform float u_effect;
uniform float u_opacity;
uniform float u_seed;

varying vec2 v_uv;

float hash(float value) {
  return fract(sin(value * 12.9898 + u_seed * 78.233) * 43758.5453);
}

float noise(vec2 point) {
  vec2 base = floor(point);
  vec2 fraction = fract(point);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  float a = hash(base.x + base.y * 57.0);
  float b = hash(base.x + 1.0 + base.y * 57.0);
  float c = hash(base.x + (base.y + 1.0) * 57.0);
  float d = hash(base.x + 1.0 + (base.y + 1.0) * 57.0);
  return mix(mix(a, b, fraction.x), mix(c, d, fraction.x), fraction.y);
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int index = 0; index < 4; index++) {
    value += noise(point) * amplitude;
    point *= 2.07;
    amplitude *= 0.5;
  }
  return value;
}

float lineDistance(vec2 point, vec2 start, vec2 end) {
  vec2 segment = end - start;
  float t = clamp(dot(point - start, segment) / dot(segment, segment), 0.0, 1.0);
  return length(point - (start + segment * t));
}

float softLine(vec2 point, vec2 start, vec2 end, float width) {
  return smoothstep(width, 0.0, lineDistance(point, start, end));
}

float lightningBolt(vec2 uv, vec2 start, vec2 end, float width, float seed) {
  float bolt = 0.0;
  vec2 previous = start;
  for (int index = 1; index <= 9; index++) {
    float t = float(index) / 9.0;
    vec2 nextPoint = mix(start, end, t);
    float jag = (hash(seed + float(index) * 19.0 + floor(u_time * 18.0)) - 0.5) * 0.16;
    nextPoint.x += jag * (1.0 - abs(t - 0.5) * 1.4);
    bolt += softLine(uv, previous, nextPoint, width);
    previous = nextPoint;
  }
  return bolt;
}

float lightningField(vec2 uv) {
  float pulse = 0.55 + 0.45 * sin(u_time * 18.0);
  float boltA = lightningBolt(uv, vec2(0.16, -0.08), vec2(0.72, 0.94), 0.012, 13.0);
  float boltB = lightningBolt(uv, vec2(1.08, 0.1), vec2(0.44, 0.86), 0.01, 31.0);
  float boltC = lightningBolt(uv, vec2(0.5, -0.06), vec2(0.6, 1.06), 0.008, 47.0);
  return (boltA + boltB + boltC) * pulse;
}

float dragonBody(vec2 uv) {
  float wave = sin((uv.x + u_time * 0.16) * 12.0) * 0.055;
  float y = 0.42 + wave;
  float body = smoothstep(0.075, 0.0, abs(uv.y - y)) * smoothstep(0.05, 0.2, uv.x) * smoothstep(0.86, 0.62, uv.x);
  float spine = smoothstep(0.022, 0.0, abs(uv.y - y - 0.012)) * smoothstep(0.16, 0.82, uv.x);
  float head = smoothstep(0.12, 0.0, length((uv - vec2(0.78, 0.38)) * vec2(1.0, 1.45)));
  float hornA = softLine(uv, vec2(0.78, 0.32), vec2(0.82, 0.2), 0.012);
  float hornB = softLine(uv, vec2(0.73, 0.33), vec2(0.72, 0.2), 0.012);
  float tail = softLine(uv, vec2(0.16, 0.43), vec2(0.04, 0.54), 0.028);
  return max(max(body, spine), max(max(head, tail), max(hornA, hornB)));
}

vec4 drawIce(vec2 uv) {
  float crack = 0.0;
  for (int index = 0; index < 8; index++) {
    float x = float(index) / 8.0 + sin(u_time * 0.7 + float(index)) * 0.025;
    crack += softLine(uv, vec2(x, 0.05), vec2(x + 0.03, 0.92), 0.01);
    crack += softLine(uv, vec2(x + 0.03, 0.48), vec2(x - 0.08, 0.78), 0.008);
  }
  float frost = fbm(uv * 8.0 + u_time * 0.12);
  vec3 color = mix(vec3(0.08, 0.46, 0.86), vec3(0.9, 1.0, 1.0), crack + frost * 0.4);
  float alpha = clamp(crack * 0.8 + frost * 0.22, 0.0, 0.78);
  return vec4(color, alpha);
}

vec4 drawEnergy(vec2 uv) {
  float band = sin((uv.x - u_time * 0.95) * 24.0) * 0.5 + 0.5;
  float scan = smoothstep(0.12, 0.0, abs(fract(uv.x * 1.8 - u_time * 0.5) - 0.5));
  float lanes = smoothstep(0.025, 0.0, abs(fract(uv.y * 5.0 + u_time * 0.25) - 0.5));
  vec3 color = vec3(0.16, 1.0, 0.92) * (0.25 + band * 0.42 + scan * 0.7 + lanes * 0.2);
  return vec4(color, clamp(0.12 + scan * 0.45 + lanes * 0.22, 0.0, 0.82));
}

vec4 drawFire(vec2 uv, float intensity) {
  float heat = fbm(vec2(uv.x * 6.0, uv.y * 5.0 - u_time * 2.2));
  float flame = smoothstep(uv.y, uv.y + 0.55 * intensity, heat * 0.58 + (1.0 - uv.y) * 0.72);
  vec3 base = mix(vec3(0.95, 0.08, 0.04), vec3(1.0, 0.55, 0.12), flame);
  vec3 hot = mix(base, vec3(1.0, 0.92, 0.5), smoothstep(0.72, 1.0, flame) * 0.5);
  float alpha = clamp(flame * (0.42 + 0.24 * intensity), 0.0, 0.92);
  return vec4(hot, alpha);
}

vec4 drawLightning(vec2 uv) {
  float field = lightningField(uv);
  float flash = pow(abs(sin(u_time * 13.0)), 18.0);
  vec3 color = vec3(0.38, 0.96, 1.0) * field * 2.4 + vec3(1.0) * field * 0.8;
  color += vec3(0.55, 0.85, 1.0) * flash * 0.45;
  float alpha = clamp(field * 1.4 + flash * 0.18, 0.0, 1.0);
  return vec4(color, alpha);
}

vec4 drawDragonDianjiang(vec2 uv) {
  float dragon = dragonBody(uv);
  float field = lightningField(uv);
  float ring = smoothstep(0.012, 0.0, abs(length(uv - vec2(0.5, 0.43)) - (0.16 + fract(u_time * 0.34) * 0.5)));
  vec3 color = vec3(0.08, 0.42, 0.58) * dragon + vec3(0.18, 0.95, 1.0) * dragon * 2.2;
  color += vec3(0.24, 0.72, 1.0) * field * 2.1;
  color += vec3(0.34, 0.9, 1.0) * ring * 0.8;
  float alpha = clamp(dragon * 0.82 + field * 0.55 + ring * 0.36, 0.0, 0.96);
  return vec4(color, alpha);
}

void main() {
  if (v_uv.x > u_progress) {
    discard;
  }

  vec4 effectColor;
  if (u_effect < 0.5) {
    effectColor = drawIce(v_uv);
  } else if (u_effect < 1.5) {
    effectColor = drawEnergy(v_uv);
  } else if (u_effect < 2.5) {
    effectColor = drawFire(v_uv, 1.0);
  } else if (u_effect < 3.5) {
    effectColor = drawFire(v_uv, 1.75);
  } else if (u_effect < 4.5) {
    effectColor = drawLightning(v_uv);
  } else {
    effectColor = drawDragonDianjiang(v_uv);
  }

  gl_FragColor = vec4(effectColor.rgb, effectColor.a * u_opacity);
}
`;

type ShaderUniforms = {
  resolution: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  progress: WebGLUniformLocation | null;
  effect: WebGLUniformLocation | null;
  opacity: WebGLUniformLocation | null;
  seed: WebGLUniformLocation | null;
};

export class ShaderEffectLayer {
  private readonly attributes: { position: number };
  private readonly uniforms: ShaderUniforms;
  private devicePixelRatio = 1;
  private lastWidth = 0;
  private lastHeight = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly program: WebGLProgram,
    private readonly maxDevicePixelRatio: number
  ) {
    this.attributes = {
      position: gl.getAttribLocation(program, "a_position")
    };
    this.uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      progress: gl.getUniformLocation(program, "u_progress"),
      effect: gl.getUniformLocation(program, "u_effect"),
      opacity: gl.getUniformLocation(program, "u_opacity"),
      seed: gl.getUniformLocation(program, "u_seed")
    };
    this.configureGeometry();
    this.resize();
  }

  public static tryCreate(canvas: HTMLCanvasElement, maxDevicePixelRatio = 1.5): ShaderEffectLayer | null {
    const gl = this.getWebGlContext(canvas);
    if (!gl) {
      return null;
    }

    try {
      const program = this.createProgram(gl);
      return new ShaderEffectLayer(canvas, gl, program, maxDevicePixelRatio);
    } catch {
      return null;
    }
  }

  public render(effect: ShaderDisplayEffect, progressPercent: number, elapsedMs: number, opacity = 1, seed = 0): void {
    this.resizeIfNeeded();
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.useProgram(this.program);
    this.gl.enableVertexAttribArray(this.attributes.position);
    this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    this.gl.uniform1f(this.uniforms.time, elapsedMs / 1000);
    this.gl.uniform1f(this.uniforms.progress, Math.max(0, Math.min(1, progressPercent / 100)));
    this.gl.uniform1f(this.uniforms.effect, EFFECT_UNIFORM_VALUES[effect]);
    this.gl.uniform1f(this.uniforms.opacity, Math.max(0, Math.min(1, opacity)));
    this.gl.uniform1f(this.uniforms.seed, seed);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  public clear(): void {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private static getWebGlContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
    const context =
      canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false }) ??
      canvas.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: false });
    return context && "createShader" in context ? (context as WebGLRenderingContext) : null;
  }

  private static createProgram(gl: WebGLRenderingContext): WebGLProgram {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, DISPLAY_EFFECT_FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) {
      throw new Error("Unable to create shader program");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Unable to link shader program");
    }

    return program;
  }

  private static compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("Unable to create shader");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "Unable to compile shader");
    }

    return shader;
  }

  private configureGeometry(): void {
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error("Unable to create shader geometry");
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW
    );
    this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, 0, 0);
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
    this.devicePixelRatio = Math.min(window.devicePixelRatio || 1, this.maxDevicePixelRatio);
    this.lastWidth = width;
    this.lastHeight = height;
    this.canvas.width = Math.round(width * this.devicePixelRatio);
    this.canvas.height = Math.round(height * this.devicePixelRatio);
  }
}
