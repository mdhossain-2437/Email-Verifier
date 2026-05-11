/**
 * Lightweight WebGL hero background — animated gradient mesh built from a
 * single full-screen quad and a fragment shader. No external dependencies,
 * no per-frame buffer churn, no measurable bundle hit (~3kb gzipped).
 *
 * The shader paints three coloured "blobs" that drift with time, blends
 * them in screen space, and adds a subtle film-grain noise to keep big
 * solid regions from looking flat on retina. The blob colours are tuned
 * to match the brand palette (ink near-black + lime accent), so it works
 * as the silent backdrop of the marketing hero.
 *
 * Falls back to a plain CSS conic-gradient if WebGL is unavailable or the
 * user has ``prefers-reduced-motion: reduce`` set — that path keeps the
 * brand colour story intact without any animation.
 *
 * Safe to mount once at the top of the landing page. Cleans up its own
 * RAF + GL resources on unmount.
 */

import { useEffect, useRef, useState } from "react";

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// One full-screen quad, three drifting blobs, soft additive blend, light
// grain. Tuned to render the ink-on-lime brand palette.
const FRAGMENT_SHADER_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float blob(vec2 uv, vec2 center, float radius, float softness) {
  float d = distance(uv, center);
  return smoothstep(radius, radius - softness, d);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  float t = u_time * 0.07;

  // Three drifting blobs. Centers move along Lissajous-style curves so the
  // motion never repeats predictably.
  vec2 c1 = vec2(0.30 * aspect + 0.18 * sin(t * 1.2), 0.30 + 0.12 * cos(t * 0.9));
  vec2 c2 = vec2(0.75 * aspect + 0.14 * cos(t * 0.8), 0.60 + 0.15 * sin(t * 1.1));
  vec2 c3 = vec2(0.50 * aspect + 0.18 * sin(t * 0.6 + 1.5), 0.85 + 0.10 * cos(t * 0.5));

  // Mouse pull — gentle parallax so the mesh tracks the cursor a little.
  vec2 m = u_mouse * vec2(aspect, 1.0);
  c1 += (m - vec2(0.5 * aspect, 0.5)) * 0.04;
  c2 += (m - vec2(0.5 * aspect, 0.5)) * 0.06;
  c3 += (m - vec2(0.5 * aspect, 0.5)) * 0.05;

  float b1 = blob(p, c1, 0.55, 0.50);
  float b2 = blob(p, c2, 0.45, 0.45);
  float b3 = blob(p, c3, 0.50, 0.55);

  // Brand colours. Lime accent (#c3f400) + a deep eggplant violet for
  // contrast that still reads as part of the same family.
  vec3 lime = vec3(0.764, 0.957, 0.000);
  vec3 violet = vec3(0.20, 0.10, 0.32);
  vec3 ember = vec3(0.55, 0.20, 0.10);

  vec3 col = vec3(0.0);
  col += lime   * b1 * 0.55;
  col += violet * b2 * 0.85;
  col += ember  * b3 * 0.40;

  // Soft vignette so the edges fall into the ink surface.
  float vignette = smoothstep(1.10, 0.20, distance(uv, vec2(0.5, 0.5)) * 1.15);
  col *= vignette;

  // Subtle film grain — keeps large flat regions from looking dead on
  // retina without becoming visible noise.
  float grain = (hash(uv * u_resolution + u_time) - 0.5) * 0.04;
  col += grain;

  // Sit on top of an ink base so the canvas can be blended into the page
  // without showing a hard rectangle.
  vec3 base = vec3(0.055, 0.055, 0.055);
  col = base + col;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

export function HeroShader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      setFallback(true);
      return;
    }

    const gl =
      (canvas.getContext("webgl", { antialias: false, alpha: false }) as
        | WebGLRenderingContext
        | null) || null;
    if (!gl) {
      setFallback(true);
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) {
      setFallback(true);
      return;
    }
    const program = linkProgram(gl, vs, fs);
    if (!program) {
      setFallback(true);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPosition = gl.getAttribLocation(program, "a_position");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uMouse = gl.getUniformLocation(program, "u_mouse");

    gl.useProgram(program);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    let raf = 0;
    const start = performance.now();
    const mouse = { x: 0.5, y: 0.5 };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = 1 - (e.clientY - rect.top) / rect.height;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (canvas.width !== targetW) canvas.width = targetW;
      if (canvas.height !== targetH) canvas.height = targetH;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const elapsed = (performance.now() - start) / 1000;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  if (fallback) {
    return (
      <div
        className={
          className ??
          "absolute inset-0 pointer-events-none [background:radial-gradient(60%_60%_at_30%_30%,rgba(195,244,0,0.10),transparent_60%),radial-gradient(50%_50%_at_70%_60%,rgba(70,30,90,0.40),transparent_70%),radial-gradient(45%_45%_at_50%_90%,rgba(140,50,30,0.20),transparent_70%)]"
        }
        aria-hidden
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "absolute inset-0 w-full h-full pointer-events-none"}
      aria-hidden
    />
  );
}
