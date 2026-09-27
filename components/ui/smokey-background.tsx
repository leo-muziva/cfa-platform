"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export interface SmokeyBackgroundProps {
  /** Dark theme glow color as a hex string, e.g. "#7C3AED". */
  color?: string;
  /** Dark theme base color the glow is mixed into. */
  baseColor?: string;
  /** Light theme glow color. */
  lightColor?: string;
  /** Light theme base color the glow is mixed into. */
  lightBaseColor?: string;
  /** Tailwind backdrop-blur size applied to the overlay above the canvas. */
  backdropBlurAmount?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
}

const BLUR_CLASS: Record<NonNullable<SmokeyBackgroundProps["backdropBlurAmount"]>, string> = {
  none: "",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

// Smoke bases per theme: deep purple-black for dark, near-white for light.
// The portal layout uses the same values for its <main> background so the
// canvas edges blend in before the first frame paints.
const DARK_BASE_HEX = "#140a2e";
const LIGHT_BASE_HEX = "#faf7ff";

const VERTEX_SOURCE = "attribute vec4 a_position; void main(){ gl_Position = a_position; }";

const FRAGMENT_SOURCE = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;
uniform vec3 u_base;
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  float time = iTime * 0.5;
  vec2 mouse = iMouse / iResolution;
  vec2 rippleCenter = 2.0 * mouse - 1.0;
  vec2 distortion = centeredUV;
  for (float i = 1.0; i < 8.0; i++) {
    distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
    distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
  }
  float wave = abs(sin(distortion.x + distortion.y + time));
  float glow = smoothstep(0.9, 0.2, wave);
  fragColor = vec4(mix(u_base, u_color, glow), 1.0);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }
`;

// Full-screen quad, two triangles covering clip space.
const QUAD_POSITIONS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

// Cap devicePixelRatio: the shader loop runs per-pixel every frame, and
// full retina resolution on a fixed backdrop is wasted GPU cost.
const MAX_DEVICE_PIXEL_RATIO = 1.5;

// The pause choice is a per-viewer convenience, so browser storage is enough.
const PAUSE_STORAGE_KEY = "cfa:smoke-paused";
const PAUSE_EVENT = "cfa:smoke-paused-change";
// In-memory copy for when storage is blocked (private windows, strict settings).
let pausedInMemory = false;

function readPausedPreference(): boolean {
  try {
    return window.localStorage.getItem(PAUSE_STORAGE_KEY) === "true";
  } catch {
    return pausedInMemory;
  }
}

function hexToRgb01(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return [0.486, 0.231, 0.929];
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function SmokeyBackground({
  color = "#7C3AED",
  baseColor = DARK_BASE_HEX,
  lightColor = "#7C3AED",
  lightBaseColor = LIGHT_BASE_HEX,
  backdropBlurAmount = "none",
  className,
}: SmokeyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      // No WebGL: leave the canvas empty and let the CSS fallback gradient
      // on the container show through instead.
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "iResolution");
    const timeLocation = gl.getUniformLocation(program, "iTime");
    const mouseLocation = gl.getUniformLocation(program, "iMouse");
    const colorLocation = gl.getUniformLocation(program, "u_color");
    const baseLocation = gl.getUniformLocation(program, "u_base");

    // resolvedTheme is undefined until next-themes mounts; its pre-paint
    // script has already set the class on <html>, so read that instead of
    // flashing the wrong palette.
    const isDark = resolvedTheme
      ? resolvedTheme === "dark"
      : document.documentElement.classList.contains("dark");
    const colorRgb = hexToRgb01(isDark ? color : lightColor);
    const baseRgb = hexToRgb01(isDark ? baseColor : lightBaseColor);
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let rafId = 0;
    let elapsedSeconds = 0;
    let lastTimestamp: number | null = null;

    const drawFrame = () => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform1f(timeLocation, elapsedSeconds);
      // The ripple stays centred: the smoke plays on its own and ignores the pointer.
      gl.uniform2f(mouseLocation, width / 2, height / 2);
      gl.uniform3f(colorLocation, colorRgb[0], colorRgb[1], colorRgb[2]);
      gl.uniform3f(baseLocation, baseRgb[0], baseRgb[1], baseRgb[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // Motion stops for reduced-motion users, for the viewer's pause toggle
    // (WCAG 2.2.2) and while the tab is hidden, which also saves battery.
    const shouldAnimate = () =>
      !reducedMotionQuery.matches && !readPausedPreference() && !document.hidden;

    const loop = (now: number) => {
      if (lastTimestamp !== null) elapsedSeconds += (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      drawFrame();
      rafId = requestAnimationFrame(loop);
    };

    const syncMotion = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastTimestamp = null;
      if (shouldAnimate()) {
        rafId = requestAnimationFrame(loop);
      } else {
        // Keep a still frame on screen rather than an empty canvas.
        drawFrame();
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      const nextWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const nextHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      // Resizing clears the drawing buffer, so repaint when not animating.
      if (!rafId) drawFrame();
    };

    resize();
    syncMotion();

    window.addEventListener("resize", resize);
    window.addEventListener(PAUSE_EVENT, syncMotion);
    document.addEventListener("visibilitychange", syncMotion);
    reducedMotionQuery.addEventListener("change", syncMotion);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener(PAUSE_EVENT, syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
      reducedMotionQuery.removeEventListener("change", syncMotion);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, [color, baseColor, lightColor, lightBaseColor, resolvedTheme]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        // CSS fallback: shows through when WebGL is unavailable or the
        // shader fails to compile, so the page still reads as intentional.
        "bg-[radial-gradient(circle_at_30%_20%,_#c4b5fd,_transparent_55%),linear-gradient(160deg,_#faf7ff,_#ede9fe)]",
        "dark:bg-[radial-gradient(circle_at_30%_20%,_#2a1458,_transparent_55%),linear-gradient(160deg,_#140a2e,_#0a0518)]",
        className,
      )}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {backdropBlurAmount !== "none" && (
        <div className={cn("absolute inset-0", BLUR_CLASS[backdropBlurAmount])} />
      )}
    </div>
  );
}

/** Lets viewers stop the animated background (WCAG 2.2.2 Pause, Stop, Hide). */
export function SmokeMotionToggle({ className }: { className?: string }) {
  // null until mounted, because the saved preference only exists in the browser.
  const [paused, setPaused] = useState<boolean | null>(null);

  useEffect(() => setPaused(readPausedPreference()), []);

  if (paused === null) {
    return <div className={cn("h-8 w-8", className)} aria-hidden="true" />;
  }

  const toggle = () => {
    const next = !paused;
    pausedInMemory = next;
    try {
      window.localStorage.setItem(PAUSE_STORAGE_KEY, String(next));
    } catch {
      // Storage can be blocked; the toggle still works for this page view.
    }
    setPaused(next);
    window.dispatchEvent(new Event(PAUSE_EVENT));
  };

  const Icon = paused ? Play : Pause;

  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={paused ? "Play background animation" : "Pause background animation"}
      title={paused ? "Play background animation" : "Pause background animation"}
      onClick={toggle}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
