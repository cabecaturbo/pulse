"use client";

import { useEffect, useRef, useState } from "react";
import SwatchQuestion from "./SwatchQuestion";
import Toggles from "./Toggles";
import CommentStep from "./CommentStep";
import Constellation from "./Constellation";
import Receipt from "./Receipt";
import {
  fetchLatestAction,
  fetchUnit,
  fetchUnitContext,
  submitCheckin,
} from "@/lib/checkin/api";
import { inCooldown, recordPersonal } from "@/lib/checkin/personal";
import type {
  CheckinAnswers,
  LatestAction,
  ShiftType,
  UnitInfo,
  UnitWeekContext,
} from "@/lib/checkin/types";

type Step =
  | "workload"
  | "support"
  | "energy"
  | "toggles"
  | "comment"
  | "constellation"
  | "receipt"
  | "cooldown"
  | "bad-code";

function guessShift(unit: UnitInfo | null): ShiftType {
  const hour = new Date().getHours();
  if (!unit) return hour >= 7 && hour < 19 ? "day" : "night";
  const day = parseInt(unit.day_shift_start.slice(0, 2), 10);
  const night = parseInt(unit.night_shift_start.slice(0, 2), 10);
  return hour >= day && hour < night ? "day" : "night";
}

export default function CheckinFlow({ code }: { code: string }) {
  const [step, setStep] = useState<Step>("workload");
  const [unit, setUnit] = useState<UnitInfo | null>(null);
  const [unitMissing, setUnitMissing] = useState(false);
  const answersRef = useRef<Partial<CheckinAnswers>>({});
  const [queued, setQueued] = useState(false);
  const [context, setContext] = useState<UnitWeekContext[]>([]);
  const [latestAction, setLatestAction] = useState<LatestAction | null>(null);

  // Unit resolution happens in the background — the first question renders
  // instantly and never waits on the network.
  useEffect(() => {
    if (inCooldown()) setStep("cooldown");
    fetchUnit(code).then((u) => {
      if (u) setUnit(u);
      else if (navigator.onLine) setUnitMissing(true);
      // Offline + unknown unit: keep going; the submit will queue and the
      // code is validated when it lands.
    });
    fetchUnitContext(code).then(setContext);
    fetchLatestAction(code).then(setLatestAction);
  }, [code]);

  useEffect(() => {
    if (unitMissing && step !== "receipt" && step !== "constellation") {
      setStep("bad-code");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitMissing]);

  async function finishComment(comment: string | null) {
    const a = answersRef.current;
    const answers: CheckinAnswers = {
      workload: a.workload!,
      support: a.support!,
      energy: a.energy!,
      got_break: a.got_break!,
      was_floated: a.was_floated!,
      is_new_grad: a.is_new_grad ?? false,
      shift_type: a.shift_type ?? guessShift(unit),
      comment,
    };
    answersRef.current = answers;
    setStep("constellation");
    recordPersonal(answers);
    // Fire-and-forget: sends now or queues for the service worker.
    submitCheckin(unit?.unit_id ?? "", answers).then((r) => setQueued(r === "queued"));
  }

  const thisWeekCount =
    context.length > 0 ? context[context.length - 1].n : 0;

  return (
    <main className="min-h-dvh bg-ink text-mist">
      {unit && step !== "receipt" && step !== "constellation" && (
        <p className="fixed left-0 right-0 top-[max(0.5rem,env(safe-area-inset-top))] z-10 text-center text-xs text-slate-500">
          {unit.unit_name} · {unit.hospital_name}
        </p>
      )}

      {step === "workload" && (
        <SwatchQuestion
          question="How heavy was the workload this shift?"
          labels={["Light", "Steady", "Busy", "Heavy", "Crushing"]}
          fiveIsGood={false}
          onPick={(v) => {
            answersRef.current.workload = v;
            setStep("support");
          }}
        />
      )}

      {step === "support" && (
        <SwatchQuestion
          question="How supported did you feel?"
          labels={["On my own", "Thin", "Okay", "Solid", "Fully backed"]}
          fiveIsGood={true}
          onPick={(v) => {
            answersRef.current.support = v;
            setStep("energy");
          }}
        />
      )}

      {step === "energy" && (
        <SwatchQuestion
          question="How's your tank walking out?"
          labels={["Running empty", "Low", "Okay", "Good", "Full tank"]}
          fiveIsGood={true}
          onPick={(v) => {
            answersRef.current.energy = v;
            setStep("toggles");
          }}
        />
      )}

      {step === "toggles" && (
        <Toggles
          shiftType={guessShift(unit)}
          onDone={(v) => {
            Object.assign(answersRef.current, v);
            setStep("comment");
          }}
        />
      )}

      {step === "comment" && <CommentStep onDone={finishComment} />}

      {step === "constellation" && (
        <Constellation weekCount={thisWeekCount} onDone={() => setStep("receipt")} />
      )}

      {step === "receipt" && (
        <Receipt
          answers={answersRef.current as CheckinAnswers}
          queued={queued}
          context={context}
          latestAction={latestAction}
          hasRep={unit?.has_rep ?? false}
        />
      )}

      {step === "cooldown" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="text-4xl">💤</div>
          <h1 className="text-2xl font-semibold">Already counted</h1>
          <p className="text-[15px] text-slate-400">
            You checked in within the last 8 hours. Come back after your next
            shift — every one counts.
          </p>
          <a href="/trust" className="mt-4 text-sm text-slate-500 underline">
            Our promise to you
          </a>
        </div>
      )}

      {step === "bad-code" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="text-4xl">🔍</div>
          <h1 className="text-2xl font-semibold">Unit not found</h1>
          <p className="text-[15px] text-slate-400">
            The code <span className="font-mono text-mist">{code}</span> doesn&apos;t
            match a unit. Re-scan the QR poster on your unit, or ask your
            manager for the right link.
          </p>
        </div>
      )}
    </main>
  );
}
