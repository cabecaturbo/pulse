"use client";

import { useRef, useState } from "react";

// Downtown editorial scale, good -> strained: moss, dry grass, wheat,
// terracotta, rust. Never red.
const SCALE = ["#7E946F", "#AEB98F", "#D8C79A", "#C98E5F", "#B05F38"];

export interface SwatchQuestionProps {
  question: string;
  labels: [string, string, string, string, string];
  /** true when 5 = good (support, energy); false when 5 = strained (workload) */
  fiveIsGood: boolean;
  onPick: (value: number) => void;
}

/**
 * One question, five stones: 48px circles with Fraunces labels. On pick:
 * letterpress press + ink bloom + settle, then auto-advance after 760ms.
 */
export default function SwatchQuestion({
  question,
  labels,
  fiveIsGood,
  onPick,
}: SwatchQuestionProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pick(value: number) {
    if (picked !== null) return;
    setPicked(value);
    navigator.vibrate?.(12);
    timer.current = setTimeout(() => onPick(value), 760);
  }

  return (
    <>
      <h1
        className="ed-serif mt-10 max-w-[300px] text-[34px] font-medium leading-[1.15]"
        style={{ textWrap: "pretty" }}
      >
        {question}
      </h1>
      <div className="mt-11 flex flex-col gap-2.5">
        {labels.map((label, i) => {
          const value = i + 1;
          const color = fiveIsGood ? SCALE[4 - i] : SCALE[i];
          const bloom = picked === value;
          return (
            <button
              key={value}
              onClick={() => pick(value)}
              className="ed-press flex min-h-14 cursor-pointer items-center gap-[22px] border-none bg-transparent p-0 py-1.5 text-left text-[#1A1815]"
            >
              <span className="relative inline-flex flex-none">
                <span
                  className="inline-block h-12 w-12 rounded-full"
                  style={{
                    background: color,
                    animation: bloom ? "ed-settle 2500ms ease-out" : "none",
                  }}
                />
                {bloom && (
                  <span
                    className="pointer-events-none absolute -inset-[3px] rounded-full"
                    style={{
                      border: `1.5px solid ${color}`,
                      animation: "ed-bloom 1100ms ease-out forwards",
                    }}
                  />
                )}
              </span>
              <span className="ed-serif text-2xl font-normal">{label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
