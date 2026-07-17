"use client";

import { useEffect, useRef, useState } from "react";
import SwatchQuestion from "./SwatchQuestion";
import Toggles from "./Toggles";
import CommentStep from "./CommentStep";
import Tally from "./Tally";
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
  | "tally"
  | "receipt"
  | "cooldown"
  | "bad-code";

const FOLIO_SUFFIX: Record<Step, string> = {
  workload: " · i / v",
  support: " · ii / v",
  energy: " · iii / v",
  toggles: " · iv / v",
  comment: " · v / v",
  tally: " · counted",
  receipt: " · shift receipt",
  cooldown: "",
  "bad-code": "",
};

/** "4-West" -> "no. 04 — west"; names without a number just lowercase. */
function folioBase(unit: UnitInfo | null): string {
  if (!unit) return "pulse";
  const m = unit.unit_name.match(/^(\d+)[-\s]*(.*)$/);
  if (m && m[2]) return `no. ${m[1].padStart(2, "0")} — ${m[2].toLowerCase()}`;
  return unit.unit_name.toLowerCase();
}

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
    });
    fetchUnitContext(code).then(setContext);
    fetchLatestAction(code).then(setLatestAction);
  }, [code]);

  useEffect(() => {
    if (unitMissing && step !== "receipt" && step !== "tally") {
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
    setStep("tally");
    recordPersonal(answers);
    submitCheckin(unit?.unit_id ?? "", answers).then((r) => setQueued(r === "queued"));
  }

  const weekVoices = context.length > 0 ? context[context.length - 1].n : 0;
  const shiftWord = answersRef.current.shift_type ?? guessShift(unit);
  const folio =
    step === "bad-code" ? "pulse" : folioBase(unit) + FOLIO_SUFFIX[step];

  const basePad = "flex min-h-dvh flex-col pr-6 pl-12";

  return (
    <main className="editorial relative min-h-dvh">
      {/* running label along the left edge */}
      <div
        className="pointer-events-none fixed left-2.5 top-[108px] z-[5]"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: "11px",
          letterSpacing: "0.25em",
          textTransform: "lowercase",
          color: "rgba(26,24,21,0.42)",
        }}
      >
        pulse — {shiftWord} shift
      </div>

      <div
        key={step}
        className={`ed-screen ${basePad} ${
          step === "receipt" || step === "cooldown" || step === "bad-code"
            ? "pb-12"
            : "pb-10"
        }`}
        style={{
          paddingTop: `max(${step === "receipt" ? 28 : 24}px, env(safe-area-inset-top))`,
        }}
      >
        {/* folio line */}
        <div
          className="ed-micro border-t pt-2"
          style={{ borderColor: "#1A1815", color: "rgba(26,24,21,0.65)" }}
        >
          {folio}
        </div>

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

        {step === "tally" && (
          <Tally weekVoices={weekVoices} onDone={() => setStep("receipt")} />
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
          <>
            <h1 className="ed-serif mt-24 text-[40px] font-medium leading-[1.1]">
              Already counted.
            </h1>
            <p
              className="ed-serif mt-5 max-w-[290px] text-xl leading-[1.4]"
              style={{ color: "rgba(26,24,21,0.8)", textWrap: "pretty" }}
            >
              You checked in within the last eight hours. Come back after your
              next shift — every one counts.
            </p>
            <a
              href="/trust"
              className="ed-micro mt-10 self-start"
              style={{ color: "rgba(26,24,21,0.55)" }}
            >
              our promise to you
            </a>
          </>
        )}

        {step === "bad-code" && (
          <>
            <h1 className="ed-serif mt-24 text-[40px] font-medium leading-[1.1]">
              That code doesn&rsquo;t land.
            </h1>
            <p
              className="ed-serif mt-5 max-w-[300px] text-xl leading-[1.4]"
              style={{ color: "rgba(26,24,21,0.8)", textWrap: "pretty" }}
            >
              The code <em>{code}</em> doesn&rsquo;t match a unit. Re-scan the
              poster on your unit, or ask your manager for the right link.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
