"use client";

import { useEffect, useMemo, useRef } from "react";

const NUMW = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

interface Stroke {
  d: string;
  color: string;
  opacity: number;
  dash: number;
  dur: number;
  delay: number;
}

/**
 * The tally: one hand-crooked ink stroke per voice this week (including the
 * one just submitted), grouped in fives — the fifth stroke is rust and drawn
 * slower, marking the k=5 anonymity threshold. Deterministic jitter, so the
 * same count always draws the same tally.
 */
function genStrokes(weekVoices: number) {
  const voices = Math.min(weekVoices + 1, 30);
  const j = (i: number, k: number) => (((i * 31 + k * 17) % 9) - 4) * 0.7;
  const strokes: Stroke[] = [];
  let t = 250;
  for (let i = 0; i < voices; i++) {
    const g = Math.floor(i / 5);
    const pos = i % 5;
    const gx = 8 + (g % 3) * 112;
    const gy = 8 + Math.floor(g / 3) * 74;
    if (pos < 4) {
      const x = gx + pos * 12;
      strokes.push({
        d: `M ${x + j(i, 1)} ${gy + 4} C ${x + j(i, 2)} ${gy + 16}, ${x + j(i, 3)} ${gy + 28}, ${x + j(i, 4)} ${gy + 42}`,
        color: "#1A1815",
        opacity: 0.8 + ((i * 13) % 18) / 100,
        dash: 52,
        dur: 130,
        delay: t,
      });
      t += 130 + 70;
    } else {
      strokes.push({
        d: `M ${gx - 5 + j(i, 1)} ${gy + 36} C ${gx + 12} ${gy + 28 + j(i, 2)}, ${gx + 30} ${gy + 16 + j(i, 3)}, ${gx + 49} ${gy + 4 + j(i, 4)}`,
        color: "#B05F38",
        opacity: 1,
        dash: 72,
        dur: 820,
        delay: t,
      });
      t += 820 + 140;
    }
  }
  const rows = Math.ceil(Math.ceil(voices / 5) / 3);
  return { strokes, total: t, voices, svgH: rows * 74 + 8 };
}

export default function Tally({
  weekVoices,
  onDone,
}: {
  weekVoices: number;
  onDone: () => void;
}) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const { strokes, total, voices, svgH } = useMemo(
    () => genStrokes(weekVoices),
    [weekVoices]
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => doneRef.current(), reduced ? 600 : total + 1800);
    return () => clearTimeout(timer);
  }, [total]);

  const word = voices <= 20 ? NUMW[voices] : String(voices);
  const voicesLine = `${word.charAt(0).toUpperCase() + word.slice(1)} voice${
    voices === 1 ? "" : "s"
  } from this unit, this week. Yours is one of them.`;

  return (
    <button
      onClick={() => doneRef.current()}
      className="flex min-h-full w-full grow cursor-pointer flex-col border-none bg-transparent p-0 text-left text-[#1A1815]"
      aria-label="Your shift, counted — tap to go on"
    >
      <span className="mt-[72px] block">
        <svg
          width={330}
          height={svgH}
          viewBox={`0 0 330 ${svgH}`}
          className="block overflow-visible"
        >
          {strokes.map((s, i) => (
            <path
              key={i}
              d={s.d}
              style={{
                fill: "none",
                stroke: s.color,
                strokeWidth: 3,
                strokeLinecap: "round",
                strokeOpacity: s.opacity,
                strokeDasharray: s.dash,
                strokeDashoffset: s.dash,
                animation: `ed-draw ${s.dur}ms ease-out ${s.delay}ms forwards`,
              }}
            />
          ))}
        </svg>
      </span>
      <span
        className="ed-serif mt-12 block max-w-[290px] text-[28px] font-normal leading-[1.25]"
        style={{ textWrap: "pretty" }}
      >
        {voicesLine}
      </span>
      {voices < 5 && (
        <span
          className="ed-serif mt-3.5 block text-[17px] italic"
          style={{ color: "rgba(26,24,21,0.7)" }}
        >
          Unit numbers unlock at five voices.
        </span>
      )}
      <span
        className="ed-micro mt-auto block pt-8"
        style={{ color: "rgba(26,24,21,0.45)" }}
      >
        your shift, counted — tap to go on
      </span>
    </button>
  );
}
