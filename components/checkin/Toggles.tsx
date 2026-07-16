"use client";

import { useState } from "react";
import type { ShiftType } from "@/lib/checkin/types";

interface TogglesProps {
  shiftType: ShiftType;
  onDone: (v: {
    got_break: boolean;
    was_floated: boolean;
    is_new_grad: boolean;
    shift_type: ShiftType;
  }) => void;
}

function BigToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[17px] font-semibold">{label}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            onClick={() => {
              navigator.vibrate?.(10);
              onChange(v);
            }}
            className={`rounded-2xl py-4 text-[17px] font-semibold transition-colors ${
              value === v
                ? "bg-teal-600 text-white"
                : "bg-white/10 text-mist"
            }`}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Toggles({ shiftType, onDone }: TogglesProps) {
  const [gotBreak, setGotBreak] = useState<boolean | null>(null);
  const [floated, setFloated] = useState<boolean | null>(null);
  const [newGrad, setNewGrad] = useState(false);
  const [shift, setShift] = useState<ShiftType>(shiftType);

  const ready = gotBreak !== null && floated !== null;

  return (
    <div className="flex min-h-dvh flex-col gap-7 px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button
        onClick={() => setShift(shift === "day" ? "night" : "day")}
        className="self-start rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium"
      >
        {shift === "day" ? "☀️ Day shift" : "🌙 Night shift"} · tap to switch
      </button>

      <BigToggle label="Did you get your break?" value={gotBreak} onChange={setGotBreak} />
      <BigToggle
        label="Were you floated to another unit?"
        value={floated}
        onChange={setFloated}
      />

      <label className="flex items-center gap-3 text-[15px] text-slate-300">
        <input
          type="checkbox"
          checked={newGrad}
          onChange={(e) => setNewGrad(e.target.checked)}
          className="h-5 w-5 accent-teal-600"
        />
        I&apos;m in my first year as a nurse
      </label>

      <div className="mt-auto">
        <button
          disabled={!ready}
          onClick={() =>
            onDone({
              got_break: gotBreak!,
              was_floated: floated!,
              is_new_grad: newGrad,
              shift_type: shift,
            })
          }
          className="w-full rounded-2xl bg-teal-600 py-4 text-[17px] font-semibold text-white disabled:opacity-30"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
