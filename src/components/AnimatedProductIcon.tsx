import { useEffect, useRef, useCallback } from 'react';

// Same Fibonacci ratios and orbital parameters as AnimatedLogo
const RATIOS = [1, 0.618, 0.382];
const DEFAULT_TOTAL_ANGLES = [0, 5 * Math.PI / 2, -3 * Math.PI / 2];
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
  settleAngle?: number; // 0 = right side, Math.PI/2 = bottom
  introAngles?: [number, number, number];
}

/**
 * Canvas-based orbital intro animation — same motion as the primary AnimatedLogo.
 * Circle 2 sweeps 450° clockwise, circle 3 sweeps 270° counter-clockwise (staggered),
 * then both settle to `settleAngle` (bottom for Growth, right for Delivery).
 *
 * Color is inherited via CSS `color` property (set `style={{ color: ... }}` on a parent).
 */
export function AnimatedProductIcon({ size = 34, settleAngle = Math.PI / 2, introAngles = DEFAULT_TOTAL_ANGLES }: AnimatedProductIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const phaseRef = useRef<'intro' | 'settling' | 'resting'>('intro');
  const startTimeRef = useRef<number | null>(null);
  const settleStartRef = useRef<number>(0);
  const currentAnglesRef = useRef<number[]>([0, 0, 0]);

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

    // ── Intro: orbital sweep, staggered fade-in ──────────────────────────────
    if (phaseRef.current === 'intro') {
      const raw = Math.min(elapsed / INTRO_DURATION, 1);
      const progress = easeOutCubic(raw);

      let parentX = cx, parentY = cy, parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;
        const angle = introAngles[i] * progress;

        const fadeStart = i * STAGGER;
        const fadeProgress = Math.min(Math.max((elapsed - fadeStart) / 0.8, 0), 1);
        // Outer circle (i=0) is always fully visible — never fades in/out
        const alpha = i === 0 ? 1 : easeOutCubic(fadeProgress);

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

      if (raw >= 1 && elapsed >= RATIOS.length * STAGGER + 0.8) {
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
          const currentAngle = currentAnglesRef.current[i] % (Math.PI * 2);
          const angle = currentAngle + (settleAngle - currentAngle) * eased;
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
          x = parentX + orbitR * Math.cos(settleAngle);
          y = parentY + orbitR * Math.sin(settleAngle);
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
  }, [size, settleAngle, introAngles]);

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
