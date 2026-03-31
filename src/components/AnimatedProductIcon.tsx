import { useEffect, useRef, useCallback } from 'react';

// Same Fibonacci ratios and orbital parameters as AnimatedLogo
const RATIOS = [1, 0.618, 0.382];
const DEFAULT_INTRO_ANGLES = [0, 5 * Math.PI / 2, -3 * Math.PI / 2];
const INTRO_DURATION = 2.5;
const STAGGER = 0.35;
const SETTLE_DURATION = 1.0;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface AnimatedProductIconProps {
  size?: number;
  /** Single settle angle for all inner circles (legacy, overridden by settleAngles) */
  settleAngle?: number;
  /** Per-circle settle angles [c1, c2, c3] — c1 is ignored (always at center) */
  settleAngles?: [number, number, number];
  /** Sweep angles for the intro phase. When startAngles is provided, added on top of startAngles. */
  introAngles?: [number, number, number];
  /** Starting angles [c1, c2, c3]. When provided, circles start here (no fade-in) and sweep from this position. */
  startAngles?: [number, number, number];
}

/**
 * Canvas-based orbital intro animation.
 *
 * Default (no startAngles): circles fade in and sweep from 0, then settle.
 * With startAngles: circles are immediately visible at their resting position,
 * sweep one orbit, and return — no disappear/reappear.
 *
 * Color is inherited via CSS `color` property.
 */
export function AnimatedProductIcon({
  size = 34,
  settleAngle = Math.PI / 2,
  settleAngles,
  introAngles = DEFAULT_INTRO_ANGLES,
  startAngles,
}: AnimatedProductIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const phaseRef = useRef<'intro' | 'settling' | 'resting'>('intro');
  const startTimeRef = useRef<number | null>(null);
  const settleStartRef = useRef<number>(0);
  const currentAnglesRef = useRef<number[]>([0, 0, 0]);

  // Resolve per-circle settle target
  const resolveSettle = (i: number) => {
    if (settleAngles) return settleAngles[i];
    return settleAngle;
  };

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = size;
    const cx = s / 2;
    const cy = s / 2;
    const baseRadius = s * 0.44;
    const dpr = window.devicePixelRatio || 1;

    // Read inherited CSS color (supports hsl vars, hex, etc.)
    const computed = getComputedStyle(canvas).color || 'rgb(139, 92, 246)';
    let rgb = '139, 92, 246';
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) rgb = `${match[1]}, ${match[2]}, ${match[3]}`;

    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) / 1000;

    ctx.clearRect(0, 0, s * dpr, s * dpr);

    // ── Intro: orbital sweep ─────────────────────────────────────────────────
    if (phaseRef.current === 'intro') {
      const raw = Math.min(elapsed / INTRO_DURATION, 1);
      const progress = easeOutCubic(raw);

      let parentX = cx, parentY = cy, parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;

        // Start from resting position if startAngles provided, else from 0
        const base = startAngles ? startAngles[i] : 0;
        const angle = base + introAngles[i] * progress;

        // Alpha: outer always visible; inner fade in unless startAngles (already visible)
        let alpha: number;
        if (i === 0 || startAngles) {
          alpha = 1;
        } else {
          const fadeStart = i * STAGGER;
          const fadeProgress = Math.min(Math.max((elapsed - fadeStart) / 0.8, 0), 1);
          alpha = easeOutCubic(fadeProgress);
        }

        let x: number, y: number;
        if (i === 0) {
          x = cx; y = cy;
        } else {
          x = parentX + orbitR * Math.cos(angle);
          y = parentY + orbitR * Math.sin(angle);
        }

        if (alpha > 0) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
          ctx.lineWidth = size > 40 ? 3.5 : 3;
          ctx.stroke();
        }

        currentAnglesRef.current[i] = angle;
        parentX = x; parentY = y; parentR = r;
      }

      const readyToSettle = startAngles
        ? raw >= 1  // no stagger wait needed
        : raw >= 1 && elapsed >= RATIOS.length * STAGGER + 0.8;

      if (readyToSettle) {
        phaseRef.current = 'settling';
        settleStartRef.current = timestamp;
      }
    }

    // ── Settling: smooth drift to final resting position ────────────────────
    if (phaseRef.current === 'settling') {
      const settleElapsed = (timestamp - settleStartRef.current) / 1000;
      const progress = Math.min(settleElapsed / SETTLE_DURATION, 1);
      const eased = easeInOutCubic(progress);

      let parentX = cx, parentY = cy, parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;

        let x: number, y: number;
        if (i === 0) {
          x = cx; y = cy;
        } else {
          const target = resolveSettle(i);
          const currentAngle = currentAnglesRef.current[i] % (Math.PI * 2);
          const angle = currentAngle + (target - currentAngle) * eased;
          x = parentX + orbitR * Math.cos(angle);
          y = parentY + orbitR * Math.sin(angle);
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb}, 1)`;
        ctx.lineWidth = size > 40 ? 3.5 : 3;
        ctx.stroke();

        parentX = x; parentY = y; parentR = r;
      }

      if (progress >= 1) phaseRef.current = 'resting';
    }

    // ── Resting: static at settled position ─────────────────────────────────
    if (phaseRef.current === 'resting') {
      let parentX = cx, parentY = cy, parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;

        let x: number, y: number;
        if (i === 0) {
          x = cx; y = cy;
        } else {
          const target = resolveSettle(i);
          x = parentX + orbitR * Math.cos(target);
          y = parentY + orbitR * Math.sin(target);
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb}, 1)`;
        ctx.lineWidth = size > 40 ? 3.5 : 3;
        ctx.stroke();

        parentX = x; parentY = y; parentR = r;
      }

      return; // Static — stop the animation loop
    }

    animRef.current = requestAnimationFrame(draw);
  }, [size, settleAngle, settleAngles, introAngles, startAngles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    phaseRef.current = 'intro';
    startTimeRef.current = null;
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [size, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="text-current shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
