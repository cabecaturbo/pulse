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

function YesNo({
  selected,
  label,
  onPick,
}: {
  selected: boolean;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="ed-serif ed-press min-w-11 cursor-pointer border-none bg-transparent p-0 py-2.5 text-left text-[22px]"
      style={{
        color: selected ? "#1A1815" : "rgba(26,24,21,0.4)",
        textDecoration: selected ? "underline" : "none",
        textUnderlineOffset: "5px",
        textDecorationThickness: "1px",
        animation: selected ? "ed-settle 2500ms ease-out" : "none",
      }}
    >
      {label}
    </button>
  );
}

export default function Toggles({ shiftType, onDone }: TogglesProps) {
  const [gotBreak, setGotBreak] = useState<boolean | null>(null);
  const [floated, setFloated] = useState<boolean | null>(null);
  const [newGrad, setNewGrad] = useState(false);
  const [shift, setShift] = useState<ShiftType>(shiftType);

  const ready = gotBreak !== null && floated !== null;

  const rows: { label: string; value: boolean | null; set: (v: boolean) => void }[] = [
    { label: "Did you get your break?", value: gotBreak, set: setGotBreak },
    { label: "Were you floated to another unit?", value: floated, set: setFloated },
  ];

  return (
    <>
      <button
        onClick={() => setShift(shift === "day" ? "night" : "day")}
        className="ed-micro ed-press-flat mt-6 cursor-pointer self-start border-none bg-transparent p-0 pt-3 text-left underline transition-transform duration-[120ms] ease-out"
        style={{ color: "rgba(26,24,21,0.65)", textUnderlineOffset: "4px" }}
      >
        {shift === "night"
          ? "night shift — tap if it was day"
          : "day shift — tap if it was night"}
      </button>

      <div className="mt-7 flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="border-b py-[26px]"
            style={{ borderColor: "#DDD6C6" }}
          >
            <p
              className="ed-serif m-0 max-w-[300px] text-[26px] font-normal leading-[1.2]"
              style={{ textWrap: "pretty" }}
            >
              {row.label}
            </p>
            <div className="mt-[18px] flex gap-9">
              <YesNo
                selected={row.value === true}
                label="Yes"
                onPick={() => {
                  navigator.vibrate?.(10);
                  row.set(true);
                }}
              />
              <YesNo
                selected={row.value === false}
                label="No"
                onPick={() => {
                  navigator.vibrate?.(10);
                  row.set(false);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setNewGrad(!newGrad)}
        className="ed-serif ed-press-flat flex cursor-pointer items-center gap-3.5 border-none bg-transparent p-0 py-[22px] text-left text-lg text-[#1A1815] transition-transform duration-[120ms] ease-out"
      >
        <span
          className="h-[13px] w-[13px] flex-none rounded-full"
          style={{
            border: "1.5px solid #1A1815",
            background: newGrad ? "#1A1815" : "transparent",
          }}
        />
        <span>I&rsquo;m in my first year as a nurse</span>
      </button>

      <div className="mt-auto pt-8">
        <button
          onClick={() =>
            ready &&
            onDone({
              got_break: gotBreak!,
              was_floated: floated!,
              is_new_grad: newGrad,
              shift_type: shift,
            })
          }
          className="ed-serif ed-press-flat cursor-pointer border-none bg-transparent p-0 py-3 text-left text-xl text-[#1A1815] underline transition-transform duration-[120ms] ease-out"
          style={{
            textUnderlineOffset: "5px",
            textDecorationThickness: "1px",
            opacity: ready ? 1 : 0.3,
            pointerEvents: ready ? "auto" : "none",
          }}
        >
          go on
        </button>
      </div>
    </>
  );
}
