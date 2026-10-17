import { effectsEnabled } from "./themes.ts";

const VERTEX_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_top;
uniform vec3 u_bottom;
uniform vec3 u_light;

float ribbon(vec2 p, float time, float seed) {
  float y = sin(p.x * 1.6 + time * 0.35 + seed) * 0.16
          + sin(p.x * 3.1 - time * 0.22 + seed * 1.7) * 0.06
          + sin(p.x * 0.7 + time * 0.12 + seed * 0.5) * 0.10;
  float distance = abs(p.y - y);
  float core = smoothstep(0.0035, 0.0, distance);
  float glow = smoothstep(0.09, 0.0, distance) * 0.12;
  return core * 0.55 + glow;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2((uv.x - 0.5) * u_resolution.x / u_resolution.y, uv.y - 0.42);

  vec3 color = mix(u_bottom, u_top, smoothstep(0.0, 1.0, uv.y));
  color += u_light * 0.08 * exp(-pow(length(p - vec2(0.35, 0.15)), 2.0) * 3.0);

  float light = 0.0;
  for (int index = 0; index < 14; index++) {
    float layer = float(index);
    vec2 shifted = p + vec2(0.0, (layer - 7.0) * 0.012);
    light += ribbon(shifted, u_time * (1.0 + layer * 0.015), layer * 0.21) * (0.35 + 0.65 * fract(layer * 0.618));
  }
  for (int index = 0; index < 6; index++) {
    float layer = float(index);
    vec2 shifted = p + vec2(0.0, 0.18 + layer * 0.02);
    light += ribbon(shifted * vec2(0.8, 1.0), u_time * 0.8, 3.0 + layer * 0.35) * 0.35;
  }

  color += u_light * light;
  color *= 1.0 - 0.35 * pow(length(uv - 0.5) * 1.3, 2.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

interface Palette {
  readonly top: readonly [number, number, number];
  readonly bottom: readonly [number, number, number];
  readonly light: readonly [number, number, number];
}

const PALETTES: Readonly<Record<string, Palette>> = {
  mono: { top: [0.01, 0.03, 0.1], bottom: [0.0, 0.12, 0.34], light: [0.55, 0.8, 1.0] },
  paper: { top: [0.93, 0.95, 0.99], bottom: [0.72, 0.82, 0.96], light: [1.0, 1.0, 1.0] },
};

const FRAME_MS = 1000 / 30;
const RESOLUTION_SCALE = 0.5;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  const program = gl.createProgram();
  if (vertex === null || fragment === null || program === null) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

export function startBackdrop(canvas: HTMLCanvasElement): void {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  const program = gl ? link(gl) : null;
  if (gl === null || program === null) {
    canvas.hidden = true;
    return;
  }

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const resolution = gl.getUniformLocation(program, "u_resolution");
  const time = gl.getUniformLocation(program, "u_time");
  const top = gl.getUniformLocation(program, "u_top");
  const bottom = gl.getUniformLocation(program, "u_bottom");
  const light = gl.getUniformLocation(program, "u_light");

  const applyPalette = (): void => {
    const palette = PALETTES[document.documentElement.dataset["theme"] ?? "mono"] ?? PALETTES["mono"];
    if (palette) {
      gl.uniform3fv(top, palette.top);
      gl.uniform3fv(bottom, palette.bottom);
      gl.uniform3fv(light, palette.light);
    }
  };

  const resize = (): void => {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * RESOLUTION_SCALE;
    canvas.width = Math.max(1, Math.floor(window.innerWidth * scale));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
  };

  let frame = 0;
  let last = 0;
  const started = performance.now();

  const draw = (now: number): void => {
    gl.uniform1f(time, (now - started) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const step = (now: number): void => {
    frame = window.requestAnimationFrame(step);
    if (now - last >= FRAME_MS) {
      last = now;
      draw(now);
    }
  };

  const sync = (): void => {
    canvas.hidden = !effectsEnabled();
    if (!effectsEnabled() || document.hidden) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    } else if (frame === 0) {
      frame = window.requestAnimationFrame(step);
    }
  };

  resize();
  applyPalette();
  draw(performance.now());

  window.addEventListener("resize", () => {
    resize();
    draw(performance.now());
  });
  window.addEventListener("bloom:theme", applyPalette);
  document.addEventListener("visibilitychange", sync);
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-effects"] });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    window.cancelAnimationFrame(frame);
    frame = 0;
    canvas.hidden = true;
  });

  sync();
}
