"use client";

import { useEffect, useState } from "react";
import type { CheckinAnswers, LatestAction, UnitWeekContext } from "@/lib/checkin/types";
import {
  hasVotedOnAction,
  markVotedOnAction,
  personalStats,
  type PersonalStats,
} from "@/lib/checkin/personal";
import { submitActionFeedback } from "@/lib/checkin/api";

const WORDS: Record<string, string[]> = {
  workload: ["", "Light", "Steady", "Busy", "Heavy", "Crushing"],
  support: ["", "On my own", "Thin", "Okay", "Solid", "Fully backed"],
  energy: ["", "Running empty", "Low", "Okay", "Good", "Full tank"],
};

const SMALL_NUMW = ["zero", "one", "two", "three", "four", "five", "six"];
const spell = (n: number) => SMALL_NUMW[n] ?? String(n);

/** "Your unit's energy has dipped two weeks running — you're not imagining it." */
export function unitContextLine(weeks: UnitWeekContext[]): string | null {
  if (weeks.length < 2) return null;
  let up = 0;
  let down = 0;
  for (let i = weeks.length - 1; i > 0; i--) {
    if (weeks[i].avg_energy > weeks[i - 1].avg_energy) {
      if (down) break;
      up++;
    } else if (weeks[i].avg_energy < weeks[i - 1].avg_energy) {
      if (up) break;
      down++;
    } else break;
  }
  if (up >= 2) return `Your unit's energy is up ${spell(up)} weeks straight.`;
  if (down >= 2)
    return `Your unit's energy has dipped ${spell(down)} weeks running — you're not imagining it.`;
  return null;
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="ed-micro m-0" style={{ color: "rgba(26,24,21,0.55)" }}>
      {children}
    </p>
  );
}

export default function Receipt({
  answers,
  queued,
  context,
  latestAction,
  hasRep = false,
}: {
  answers: CheckinAnswers;
  queued: boolean;
  context: UnitWeekContext[];
  latestAction: LatestAction | null;
  hasRep?: boolean;
}) {
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [voted, setVoted] = useState<null | boolean>(null);

  useEffect(() => {
    setStats(personalStats());
    if (latestAction && hasVotedOnAction(latestAction.action_id)) setVoted(true);
  }, [latestAction]);

  async function vote(helped: boolean) {
    if (!latestAction || voted !== null) return;
    navigator.vibrate?.(10);
    setVoted(helped);
    markVotedOnAction(latestAction.action_id);
    await submitActionFeedback(latestAction.action_id, helped);
  }

  const contextLine = unitContextLine(context);

  const rows: { k: string; v: string }[] = [
    { k: "workload", v: WORDS.workload[answers.workload] },
    { k: "support", v: WORDS.support[answers.support] },
    { k: "energy", v: WORDS.energy[answers.energy] },
    { k: "break", v: answers.got_break ? "Yes" : "No" },
  ];
  if (answers.was_floated) rows.push({ k: "floated", v: "Yes" });

  return (
    <>
      <h1
        className="ed-serif mt-9 text-[40px] font-medium leading-[1.1]"
        style={{ textWrap: "pretty" }}
      >
        Thank you.
        <br />
        It counted.
      </h1>

      {queued && (
        <p
          className="ed-serif mt-4 max-w-[290px] text-[17px] italic"
          style={{ color: "rgba(26,24,21,0.7)" }}
        >
          Saved on this phone — it will send itself when you&rsquo;re back in
          signal.
        </p>
      )}

      {/* this shift */}
      <div className="mt-11 border-t pt-3.5" style={{ borderColor: "#DDD6C6" }}>
        <MicroLabel>this shift</MicroLabel>
        <div className="mt-4 flex flex-col gap-2.5">
          {rows.map((r) => (
            <div
              key={r.k}
              className="grid items-baseline gap-4"
              style={{ gridTemplateColumns: "92px 1fr" }}
            >
              <span className="ed-micro" style={{ color: "rgba(26,24,21,0.55)" }}>
                {r.k}
              </span>
              <span className="ed-serif text-[22px]">{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* your ledger — device only */}
      {stats && stats.shiftsLogged > 0 && (
        <div className="mt-9 border-t pt-3.5" style={{ borderColor: "#DDD6C6" }}>
          <MicroLabel>your ledger — this phone only, never sent</MicroLabel>
          <div className="mt-3 flex flex-wrap items-baseline gap-9">
            <div>
              <p className="ed-serif m-0 text-[64px] font-medium leading-none">
                {stats.shiftsLogged}
              </p>
              <p
                className="ed-micro m-0 mt-0.5 max-w-[110px]"
                style={{ color: "rgba(26,24,21,0.55)" }}
              >
                shifts logged
              </p>
            </div>
            {stats.breakRatePct !== null && (
              <div>
                <p className="ed-serif m-0 text-[64px] font-medium leading-none">
                  {stats.breakRatePct}%
                </p>
                <p
                  className="ed-micro m-0 mt-0.5 max-w-[110px]"
                  style={{ color: "rgba(26,24,21,0.55)" }}
                >
                  break rate
                </p>
              </div>
            )}
            {stats.hardestStretch && (
              <div>
                <p className="ed-serif m-0 pt-2 text-[30px] font-medium leading-none">
                  {stats.hardestStretch}
                </p>
                <p
                  className="ed-micro m-0 mt-0.5 max-w-[110px]"
                  style={{ color: "rgba(26,24,21,0.55)" }}
                >
                  hardest stretch this month
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* unit context — only when the 5-voice floor is met */}
      {contextLine && (
        <p
          className="ed-serif m-0 mt-9 max-w-[300px] text-xl italic leading-[1.35]"
          style={{ textWrap: "pretty" }}
        >
          {contextLine}
        </p>
      )}

      {/* your manager acted on this */}
      {latestAction && (
        <div className="mt-9 border-t pt-3.5" style={{ borderColor: "#DDD6C6" }}>
          <MicroLabel>your manager acted on this</MicroLabel>
          <p
            className="ed-serif m-0 mt-3.5 max-w-[300px] text-[22px] leading-[1.3]"
            style={{ textWrap: "pretty" }}
          >
            {latestAction.action_text}
          </p>
          {voted === null ? (
            <div className="mt-[18px] flex gap-8">
              <button
                onClick={() => vote(true)}
                className="ed-serif ed-press-text cursor-pointer border-none bg-transparent p-0 py-2 text-[17px] text-[#1A1815] underline transition-transform duration-[120ms] ease-out"
                style={{ textUnderlineOffset: "4px" }}
              >
                it helped
              </button>
              <button
                onClick={() => vote(false)}
                className="ed-serif ed-press-text cursor-pointer border-none bg-transparent p-0 py-2 text-[17px] underline transition-transform duration-[120ms] ease-out"
                style={{ color: "rgba(26,24,21,0.6)", textUnderlineOffset: "4px" }}
              >
                not yet
              </button>
            </div>
          ) : (
            <p
              className="ed-serif m-0 mt-[18px] text-[17px] italic"
              style={{
                color: "rgba(26,24,21,0.7)",
                animation: "ed-reveal 900ms ease-out",
              }}
            >
              Noted — anonymously, like everything here.
            </p>
          )}
        </div>
      )}

      {hasRep && (
        <p
          className="ed-serif m-0 mt-8 max-w-[290px] text-base italic"
          style={{ color: "rgba(26,24,21,0.7)" }}
        >
          Your unit rep sees the same dashboard your manager does.
        </p>
      )}

      <a
        href="/trust"
        className="ed-micro mt-12 self-start"
        style={{ color: "rgba(26,24,21,0.55)" }}
      >
        what we collect — and what we never do
      </a>
    </>
  );
}
