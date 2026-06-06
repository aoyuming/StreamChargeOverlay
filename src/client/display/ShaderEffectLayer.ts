import type { ProgressEffect } from "./ProgressPanel";

export type ShaderDisplayEffect = ProgressEffect | "dianjiang";

export const EFFECT_UNIFORM_VALUES: Record<ShaderDisplayEffect, number> = {
  ice: 0,
  energy: 1,
  water: 2,
  steam: 3,
  fire: 4,
  inferno: 5,
  lightning: 6,
  dianjiang: 7
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

const float STAGE_INFERNO_INTENSITY = 2.55;
const float PROGRESS_EFFECT_BOOST = 1.38;

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

float chargedEdgeMask(vec2 uv) {
  float frontEdge = 1.0 - smoothstep(0.0, 0.038, abs(uv.x - u_progress));
  float topEdge = 1.0 - smoothstep(0.0, 0.055, uv.y);
  float bottomEdge = 1.0 - smoothstep(0.0, 0.055, 1.0 - uv.y);
  return max(frontEdge, max(topEdge, bottomEdge) * 0.62);
}

float centerRelief(vec2 uv) {
  vec2 centered = (uv - vec2(0.5, 0.52)) * vec2(1.0, 0.78);
  return smoothstep(0.18, 0.62, length(centered));
}

float stageElementMask(vec2 uv) {
  float leftEdge = 1.0 - smoothstep(0.0, 0.22, uv.x);
  float rightEdge = 1.0 - smoothstep(0.0, 0.22, 1.0 - uv.x);
  float topEdge = 1.0 - smoothstep(0.0, 0.18, uv.y);
  float bottomEdge = 1.0 - smoothstep(0.0, 0.2, 1.0 - uv.y);
  float edge = max(max(leftEdge, rightEdge), max(topEdge, bottomEdge));
  float corner = max(leftEdge, rightEdge) * max(topEdge, bottomEdge);
  float movingTexture = fbm(uv * 5.8 + vec2(u_time * 0.18, -u_time * 0.14));
  return clamp(edge * (0.68 + movingTexture * 0.32) + corner * 0.34 + centerRelief(uv) * 0.18, 0.0, 1.0);
}

float stageGlassSweep(vec2 uv) {
  float sweepLine = fract(u_time * 0.18) * 1.8 - 0.42;
  float diagonal = uv.x * 0.74 + uv.y * 0.54;
  float wideSweep = smoothstep(0.12, 0.0, abs(diagonal - sweepLine));
  float fineScan = smoothstep(0.018, 0.0, abs(fract((uv.y + u_time * 0.08) * 7.0) - 0.5));
  return clamp(wideSweep + fineScan * 0.18, 0.0, 1.0);
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
  float pulse = 0.68 + 0.32 * sin(u_time * 22.0);
  float boltA = lightningBolt(uv, vec2(0.16, -0.08), vec2(0.72, 0.94), 0.014, 13.0);
  float boltB = lightningBolt(uv, vec2(1.08, 0.1), vec2(0.44, 0.86), 0.012, 31.0);
  float boltC = lightningBolt(uv, vec2(0.5, -0.06), vec2(0.6, 1.06), 0.01, 47.0);
  return (boltA + boltB + boltC) * pulse;
}

float forkedLightningField(vec2 uv) {
  float mainField = lightningField(uv) * 1.32;
  float branchA = lightningBolt(uv, vec2(0.24, 0.18), vec2(0.02, 0.66), 0.007, 71.0);
  float branchB = lightningBolt(uv, vec2(0.56, 0.28), vec2(0.92, 0.74), 0.0075, 83.0);
  float branchC = lightningBolt(uv, vec2(0.64, 0.05), vec2(0.26, 0.98), 0.0065, 97.0);
  float microForks = fbm(uv * 18.0 + vec2(u_time * 2.2, -u_time * 1.6));
  return mainField + (branchA + branchB + branchC) * (0.72 + microForks * 0.34);
}

float frostMist(vec2 uv) {
  float rollingMist = fbm(uv * 6.4 + vec2(u_time * 0.16, -u_time * 0.1));
  float fineMist = fbm(uv * 18.0 + vec2(-u_time * 0.22, u_time * 0.18));
  float edgeFrost = max(
    1.0 - smoothstep(0.0, 0.28, uv.x),
    max(1.0 - smoothstep(0.0, 0.24, 1.0 - uv.x), max(1.0 - smoothstep(0.0, 0.24, uv.y), 1.0 - smoothstep(0.0, 0.24, 1.0 - uv.y)))
  );
  return clamp(rollingMist * 0.44 + fineMist * 0.3 + edgeFrost * 0.54, 0.0, 1.0);
}

float drawFrostCracks(vec2 uv) {
  float crack = 0.0;
  vec2 center = vec2(0.48 + sin(u_time * 0.34) * 0.035, 0.48 + cos(u_time * 0.28) * 0.026);

  for (int index = 0; index < 11; index++) {
    float seed = float(index) * 17.0 + floor(u_time * 1.6);
    float angle = seed * 0.71 + hash(seed) * 1.7;
    vec2 dir = vec2(cos(angle), sin(angle));
    float reach = 0.28 + hash(seed + 3.0) * 0.55;
    vec2 start = center + dir * (0.035 + hash(seed + 7.0) * 0.08);
    vec2 end = center + dir * reach;
    crack += softLine(uv, start, end, 0.0068);

    vec2 middle = mix(start, end, 0.48 + hash(seed + 13.0) * 0.28);
    vec2 branchDir = vec2(-dir.y, dir.x) * (hash(seed + 19.0) > 0.5 ? 1.0 : -1.0);
    crack += softLine(uv, middle, middle + normalize(dir * 0.52 + branchDir * 0.78) * reach * 0.36, 0.0048);
  }

  float chippedEdge = softLine(uv, vec2(0.02, 0.92), vec2(0.24, 0.82), 0.006);
  chippedEdge += softLine(uv, vec2(0.83, 0.1), vec2(0.98, 0.24), 0.006);
  return clamp(crack + chippedEdge, 0.0, 1.0);
}

vec4 drawIce(vec2 uv) {
  float frost = frostMist(uv);
  float crack = drawFrostCracks(uv);
  float glint = pow(max(0.0, sin((uv.x + uv.y + u_time * 0.45) * 18.0)), 7.0);
  vec3 deepIce = vec3(0.035, 0.28, 0.62);
  vec3 electricIce = vec3(0.36, 0.88, 1.0);
  vec3 whiteCold = vec3(0.92, 1.0, 1.0);
  vec3 color = mix(deepIce, electricIce, frost * 0.7);
  color = mix(color, whiteCold, crack * 0.86 + glint * 0.28);
  float alpha = clamp(frost * 0.34 + crack * 0.92 + glint * 0.16, 0.0, 0.9);
  return vec4(color * PROGRESS_EFFECT_BOOST, alpha);
}

vec4 drawEnergy(vec2 uv) {
  float band = sin((uv.x - u_time * 0.95) * 24.0) * 0.5 + 0.5;
  float scan = smoothstep(0.12, 0.0, abs(fract(uv.x * 1.8 - u_time * 0.5) - 0.5));
  float lanes = smoothstep(0.025, 0.0, abs(fract(uv.y * 5.0 + u_time * 0.25) - 0.5));
  vec3 color = vec3(0.16, 1.0, 0.92) * (0.25 + band * 0.42 + scan * 0.7 + lanes * 0.2);
  return vec4(color, clamp(0.12 + scan * 0.45 + lanes * 0.22, 0.0, 0.82));
}

float waterCaustics(vec2 uv) {
  vec2 flow = uv + vec2(u_time * 0.12, sin(u_time * 0.38) * 0.04);
  float waveA = sin((flow.x * 13.0 + fbm(flow * 5.2) * 3.2) - u_time * 1.8);
  float waveB = sin((flow.x * 7.5 - flow.y * 9.0) + u_time * 1.15);
  float ripples = smoothstep(0.72, 1.0, abs(waveA * 0.58 + waveB * 0.42));
  float bubbles = smoothstep(0.82, 1.0, noise(uv * 28.0 + vec2(u_time * 0.18, -u_time * 0.42)));
  return clamp(ripples * 0.56 + bubbles * 0.24 + fbm(uv * 8.0 + u_time * 0.2) * 0.22, 0.0, 1.0);
}

vec4 drawWater(vec2 uv) {
  float depth = smoothstep(0.0, 1.0, uv.y);
  float surface = smoothstep(0.052, 0.0, abs(fract(uv.y * 7.0 + sin(uv.x * 6.0 + u_time * 0.9) * 0.035) - 0.5));
  float caustics = waterCaustics(uv);
  float edgeWash = max(
    max(1.0 - smoothstep(0.0, 0.2, uv.x), 1.0 - smoothstep(0.0, 0.2, 1.0 - uv.x)),
    max(1.0 - smoothstep(0.0, 0.16, uv.y), 1.0 - smoothstep(0.0, 0.18, 1.0 - uv.y))
  );
  vec3 deepWater = vec3(0.015, 0.16, 0.34);
  vec3 cyanWater = vec3(0.06, 0.68, 0.92);
  vec3 foam = vec3(0.72, 1.0, 1.0);
  vec3 color = mix(deepWater, cyanWater, 0.36 + depth * 0.24 + caustics * 0.44);
  color = mix(color, foam, surface * 0.42 + caustics * 0.22);
  float alpha = clamp(0.14 + caustics * 0.34 + surface * 0.24 + edgeWash * 0.18, 0.0, 0.72);
  return vec4(color * 1.18, alpha);
}

vec4 drawSteam(vec2 uv) {
  vec4 water = drawWater(uv);
  float vapor = fbm(uv * 5.8 + vec2(u_time * 0.16, -u_time * 0.36));
  float lift = smoothstep(1.0, 0.08, uv.y);
  float warmEdge = smoothstep(0.82, 1.0, uv.x) * smoothstep(0.18, 0.95, uv.y);
  vec3 steamTint = mix(vec3(0.72, 1.0, 1.0), vec3(1.0, 0.48, 0.18), warmEdge * 0.34);
  vec3 color = mix(water.rgb, steamTint, vapor * lift * 0.46);
  float alpha = clamp(water.a * 0.66 + vapor * lift * 0.26 + warmEdge * 0.08, 0.0, 0.68);
  return vec4(color, alpha);
}

vec4 drawFire(vec2 uv, float intensity) {
  vec2 warped = uv + vec2(sin(uv.y * 12.0 + u_time * 3.4), sin(uv.x * 8.0 - u_time * 2.2)) * 0.025 * intensity;
  float heat = fbm(vec2(warped.x * (6.5 + intensity), warped.y * 5.4 - u_time * (2.6 + intensity * 0.65)));
  float tongues = pow(max(0.0, sin((warped.x * 18.0 + heat * 5.0) - u_time * 5.2)), 2.0);
  float verticalFuel = pow(1.0 - uv.y, 0.58);
  float flame = smoothstep(0.2, 0.86, heat * 0.74 + verticalFuel * (0.75 + intensity * 0.22) + tongues * 0.18);
  float whiteCore = smoothstep(0.72, 1.0, flame) * smoothstep(0.78, 0.06, uv.y) * (0.46 + intensity * 0.18);
  vec3 base = mix(vec3(0.72, 0.03, 0.025), vec3(1.0, 0.34, 0.06), flame);
  vec3 hot = mix(base, vec3(1.0, 0.88, 0.42), whiteCore);
  hot += vec3(1.0, 0.2, 0.04) * tongues * 0.22 * intensity;
  float alpha = clamp(flame * (0.48 + 0.26 * intensity) + whiteCore * 0.12, 0.0, 0.98);
  return vec4(hot, alpha);
}

vec4 drawLightning(vec2 uv) {
  float field = forkedLightningField(uv);
  float flash = pow(abs(sin(u_time * 15.5)), 13.0);
  float strobe = pow(abs(sin(u_time * 27.0 + fbm(uv * 9.0) * 3.0)), 18.0);
  vec3 color = vec3(0.2, 0.9, 1.0) * field * 3.05 + vec3(1.0) * field * 1.15;
  color += vec3(0.54, 0.84, 1.0) * (flash * 0.62 + strobe * 0.36);
  float alpha = clamp(field * 1.72 + flash * 0.26 + strobe * 0.18, 0.0, 1.0);
  return vec4(color, alpha);
}

float dianjiangFlash(vec2 uv) {
  float strobe = pow(abs(sin(u_time * 9.4)), 8.0);
  float snap = pow(abs(sin(u_time * 23.0 + fbm(uv * 7.0) * 4.0)), 16.0);
  float diagonalA = smoothstep(0.09, 0.0, abs(uv.y - (1.0 - uv.x) - sin(u_time * 3.2) * 0.18));
  float diagonalB = smoothstep(0.075, 0.0, abs(uv.y - uv.x + cos(u_time * 2.8) * 0.16));
  float edgeBurst = max(
    max(1.0 - smoothstep(0.0, 0.16, uv.x), 1.0 - smoothstep(0.0, 0.16, 1.0 - uv.x)),
    max(1.0 - smoothstep(0.0, 0.14, uv.y), 1.0 - smoothstep(0.0, 0.14, 1.0 - uv.y))
  );
  return clamp(strobe * 0.42 + snap * 0.24 + (diagonalA + diagonalB) * 0.34 + edgeBurst * 0.2, 0.0, 1.0);
}

vec4 drawDianjiangLightning(vec2 uv) {
  float field = forkedLightningField(uv) * 1.72;
  field += lightningBolt(uv, vec2(-0.08, 0.1), vec2(0.88, 0.82), 0.016, 131.0) * 1.12;
  field += lightningBolt(uv, vec2(1.08, 0.0), vec2(0.18, 0.9), 0.015, 149.0) * 1.08;
  field += lightningBolt(uv, vec2(0.5, -0.12), vec2(0.48, 1.12), 0.018, 173.0) * 1.18;
  field += lightningBolt(uv, vec2(-0.05, 0.62), vec2(1.04, 0.42), 0.012, 191.0) * 0.78;

  float flash = dianjiangFlash(uv);
  float electricFog = fbm(uv * 9.0 + vec2(u_time * 1.7, -u_time * 1.2)) * flash;
  vec3 color = vec3(0.08, 0.66, 1.0) * field * 3.15;
  color += vec3(0.36, 1.0, 1.0) * field * 1.2;
  color += vec3(1.0) * (field * 0.92 + flash * 0.68);
  color += vec3(0.18, 0.42, 1.0) * electricFog * 0.72;
  float alpha = clamp(field * 1.32 + flash * 0.46 + electricFog * 0.2, 0.0, 1.0);
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
    effectColor = drawWater(v_uv);
  } else if (u_effect < 3.5) {
    effectColor = drawSteam(v_uv);
  } else if (u_effect < 4.5) {
    effectColor = drawFire(v_uv, 1.58);
  } else if (u_effect < 5.5) {
    effectColor = drawFire(v_uv, STAGE_INFERNO_INTENSITY);
  } else if (u_effect < 6.5) {
    effectColor = drawLightning(v_uv);
  } else {
    effectColor = drawDianjiangLightning(v_uv);
  }

  float rimGlow = chargedEdgeMask(v_uv) * (0.42 + 0.58 * pow(abs(sin(u_time * 9.0)), 3.0));
  float edgeSpark = rimGlow * (0.55 + 0.45 * fbm(v_uv * 34.0 + u_time * 1.7)) * PROGRESS_EFFECT_BOOST;
  float warmEdgeMix = step(3.5, u_effect) * (1.0 - step(6.5, u_effect));
  effectColor.rgb += mix(vec3(0.28, 0.9, 1.0), vec3(1.0, 0.28, 0.08), warmEdgeMix) * edgeSpark * 0.72;
  effectColor.a = clamp(effectColor.a + edgeSpark * 0.48, 0.0, 1.0);

  float isFullStage = step(0.985, u_progress) * (1.0 - step(0.995, u_opacity));
  float fireStageTreatment = isFullStage * step(3.5, u_effect) * (1.0 - step(5.5, u_effect));
  if (fireStageTreatment > 0.5) {
    float elementMask = stageElementMask(v_uv);
    float relief = centerRelief(v_uv);
    float glass = stageGlassSweep(v_uv);
    vec3 glassTint = mix(vec3(0.16, 0.86, 1.0), vec3(1.0, 0.34, 0.08), warmEdgeMix);
    effectColor.rgb += glassTint * (glass * 0.34 + elementMask * 0.16);
    effectColor.a = clamp(effectColor.a * (0.38 + relief * 0.34 + elementMask * 0.42) + glass * 0.12, 0.0, 1.0);
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
