import { useEffect, useRef, useCallback } from "react";

// 3 Fibonacci-scaled circles
const RATIOS = [1, 0.618, 0.382];

// Total rotation angles for the intro animation
const TOTAL_ANGLES = [
  0,
  5 * Math.PI / 2,
  -3 * Math.PI / 2,
];

const INTRO_DURATION = 3;
const STAGGER = 0.35;

// Continuous orbit speeds (radians/sec) when animating
const ORBIT_SPEEDS = [0, 1.2, -0.9];

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface AnimatedLogoProps {
  size?: number;
  isAnimating?: boolean;
}

export function AnimatedLogo({ size = 32, isAnimating = false }: AnimatedLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const phaseRef = useRef<"intro" | "orbiting" | "settling" | "resting">("intro");
  const startTimeRef = useRef<number | null>(null);
  const orbitStartRef = useRef<number>(0);
  const settleStartRef = useRef<number>(0);
  const currentAnglesRef = useRef<number[]>([0, 0, 0]);
  const wasAnimatingRef = useRef(isAnimating);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = size;
    const cx = s / 2;
    const cy = s / 2;
    const baseRadius = s * 0.44;

    // Use currentColor from CSS (works with dark/light mode)
    const color = getComputedStyle(canvas).color || "139, 92, 246";
    // Extract RGB from computed color
    let rgb = "139, 92, 246";
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) rgb = `${match[1]}, ${match[2]}, ${match[3]}`;

    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) / 1000;

    ctx.clearRect(0, 0, s * (window.devicePixelRatio || 1), s * (window.devicePixelRatio || 1));

    // Transition: was animating, now stopped → settle
    if (wasAnimatingRef.current && !isAnimating && phaseRef.current === "orbiting") {
      phaseRef.current = "settling";
      settleStartRef.current = timestamp;
    }
    wasAnimatingRef.current = isAnimating;

    // Phase: intro (initial load animation)
    if (phaseRef.current === "intro") {
      const raw = Math.min(elapsed / INTRO_DURATION, 1);
      const progress = easeOutCubic(raw);

      let parentX = cx;
      let parentY = cy;
      let parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;
        const angle = TOTAL_ANGLES[i] * progress;

        const fadeStart = i * STAGGER;
        const fadeProgress = Math.min(Math.max((elapsed - fadeStart) / 0.8, 0), 1);
        const alpha = easeOutCubic(fadeProgress);

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
        // Intro done — go to orbiting if animating, else settle to rest
        if (isAnimating) {
          phaseRef.current = "orbiting";
          orbitStartRef.current = timestamp;
        } else {
          phaseRef.current = "settling";
          settleStartRef.current = timestamp;
        }
      }
    }

    // Phase: continuous orbiting while crawl is running
    if (phaseRef.current === "orbiting") {
      const t = (timestamp - orbitStartRef.current) / 1000;

      let parentX = cx;
      let parentY = cy;
      let parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;
        const angle = currentAnglesRef.current[i] + ORBIT_SPEEDS[i] * t;

        let x: number, y: number;
        if (i === 0) {
          x = cx; y = cy;
        } else {
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
    }

    // Phase: settling to rest (circles drift to bottom)
    if (phaseRef.current === "settling") {
      const SETTLE_DURATION = 1.5;
      const settleElapsed = (timestamp - settleStartRef.current) / 1000;
      const progress = Math.min(settleElapsed / SETTLE_DURATION, 1);
      const eased = easeInOutCubic(progress);

      // Target: all inner circles at bottom (angle = PI/2)
      const targetAngle = Math.PI / 2;

      let parentX = cx;
      let parentY = cy;
      let parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;

        let x: number, y: number;
        if (i === 0) {
          x = cx; y = cy;
        } else {
          // Lerp current angle to target
          const currentAngle = currentAnglesRef.current[i] % (Math.PI * 2);
          const angle = currentAngle + (targetAngle - currentAngle) * eased;
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

      if (progress >= 1) {
        phaseRef.current = "resting";
      }
    }

    // Phase: resting (static, circles at bottom)
    if (phaseRef.current === "resting") {
      let parentX = cx;
      let parentY = cy;
      let parentR = baseRadius;

      for (let i = 0; i < RATIOS.length; i++) {
        const r = baseRadius * RATIOS[i];
        const orbitR = parentR - r;
        const angle = Math.PI / 2; // bottom

        let x: number, y: number;
        if (i === 0) {
          x = cx; y = cy;
        } else {
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

      // If animating resumes, transition back to orbiting
      if (isAnimating) {
        phaseRef.current = "orbiting";
        orbitStartRef.current = timestamp;
        currentAnglesRef.current = [0, Math.PI / 2, Math.PI / 2];
      } else {
        // Static — no need to keep animating
        return;
      }
    }

    animRef.current = requestAnimationFrame(draw);
  }, [size, isAnimating]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    phaseRef.current = "intro";
    startTimeRef.current = null;
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [size, draw]);

  // Restart animation loop when isAnimating changes
  useEffect(() => {
    if (isAnimating && phaseRef.current === "resting") {
      animRef.current = requestAnimationFrame(draw);
    }
    if (!isAnimating && phaseRef.current === "orbiting") {
      // draw loop will handle the transition
    }
  }, [isAnimating, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="text-primary shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
