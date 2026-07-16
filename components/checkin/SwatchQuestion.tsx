"use client";

import { useState } from "react";

// Pulse scale, good -> strained. Never red.
const GOOD_TO_STRAINED = ["#0f766e", "#14b8a6", "#64748b", "#d97706", "#b45309"];

export interface SwatchQuestionProps {
  question: string;
  labels: [string, string, string, string, string];
  /** true when 5 = good (support, energy); false when 5 = strained (workload) */
  fiveIsGood: boolean;
  onPick: (value: number) => void;
}

export default function SwatchQuestion({
  question,
  labels,
  fiveIsGood,
  onPick,
}: SwatchQuestionProps) {
  const [picked, setPicked] = useState<number | null>(null);

  function pick(value: number) {
    if (picked !== null) return;
    setPicked(value);
    navigator.vibrate?.(12);
    // Let the spring play before advancing.
    setTimeout(() => onPick(value), 220);
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-5 text-[1.7rem] font-semibold leading-tight">{question}</h1>
      <div className="flex flex-1 flex-col gap-2.5">
        {labels.map((label, i) => {
          const value = i + 1;
          const color = fiveIsGood ? GOOD_TO_STRAINED[4 - i] : GOOD_TO_STRAINED[i];
          return (
            <button
              key={value}
              onClick={() => pick(value)}
              className={`flex flex-1 items-center justify-between rounded-2xl px-6 text-left text-[17px] font-semibold text-white ${
                picked === value ? "tap-spring" : ""
              }`}
              style={{
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                minHeight: "3.5rem",
              }}
            >
              <span>{label}</span>
              <span className="text-white/60">{value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
