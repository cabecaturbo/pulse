"use client";

import { useEffect, useRef } from "react";

/**
 * The one indulgent animation: the nurse's response becomes a glowing dot
 * that drifts into this week's constellation of anonymous unit dots.
 * Dots are positional only — they carry no per-response data. The count comes
 * from a k-anonymity-respecting aggregate (or 0 when the floor isn't met,
 * which renders a calm, sparse field).
 */
export default function Constellation({
  weekCount,
  onDone,
}: {
  weekCount: number;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const n = Math.min(Math.max(weekCount, 6), 40);
    // Deterministic-ish scatter that still feels organic.
    const dots = Array.from({ length: n }, (_, i) => {
      const a = (i * 2.399963) % (Math.PI * 2); // golden angle
      const r = 40 + ((i * 97) % 100) * (Math.min(w, h) / 340);
      return {
        x: w / 2 + Math.cos(a) * r,
        y: h * 0.42 + Math.sin(a) * r * 0.72,
        tw: 0.5 + ((i * 31) % 50) / 100,
      };
    });

    const start = performance.now();
    const DURATION = 2000;
    let raf = 0;

    function frame(now: number) {
      const t = Math.min((now - start) / DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      ctx.clearRect(0, 0, w, h);

      // Constellation fades in.
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 210, 205, ${0.15 + 0.5 * ease * d.tw})`;
        ctx.fill();
      }

      // The nurse's dot rises from the thumb zone into the field.
      const myX = w / 2 + (dots[0].x - w / 2) * ease;
      const myY = h * 0.85 + (dots[0].y - h * 0.85) * ease;
      const glow = ctx.createRadialGradient(myX, myY, 0, myX, myY, 18);
      glow.addColorStop(0, "rgba(20, 184, 166, 0.9)");
      glow.addColorStop(1, "rgba(20, 184, 166, 0)");
      ctx.beginPath();
      ctx.arc(myX, myY, 18, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(myX, myY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#5eead4";
      ctx.fill();

      if (t < 1) raf = requestAnimationFrame(frame);
      else setTimeout(() => doneRef.current(), 150);
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      doneRef.current();
      return;
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [weekCount]);

  return (
    <button
      onClick={() => doneRef.current()}
      className="fixed inset-0 z-50 block bg-ink"
      aria-label="Skip animation"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <span className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-0 right-0 text-center text-sm text-slate-500">
        your shift, counted · tap to skip
      </span>
    </button>
  );
}
