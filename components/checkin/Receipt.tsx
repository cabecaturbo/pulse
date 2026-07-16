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

/** "your unit's energy is up 2 weeks straight" — only from 5+ response weeks. */
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
  if (up >= 2) return `Your unit's energy is up ${up} weeks straight.`;
  if (down >= 2) return `Your unit's energy has dipped ${down} weeks running — you're not imagining it.`;
  return null;
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 pb-12 pt-[max(2rem,env(safe-area-inset-top))]">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-teal-400">
          Shift receipt
        </p>
        <h1 className="mt-1 text-3xl font-bold">Thanks. That counted.</h1>
        {queued && (
          <p className="mt-2 rounded-xl bg-teal-950/60 px-4 py-3 text-[15px] text-teal-200">
            Saved — will send when you&apos;re back in signal.
          </p>
        )}
      </div>

      {/* (a) this shift */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          This shift
        </h2>
        <dl className="mt-4 space-y-3 text-[17px]">
          <div className="flex justify-between">
            <dt className="text-slate-400">Workload</dt>
            <dd className="font-semibold">{WORDS.workload[answers.workload]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Support</dt>
            <dd className="font-semibold">{WORDS.support[answers.support]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Energy</dt>
            <dd className="font-semibold">{WORDS.energy[answers.energy]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Break</dt>
            <dd className="font-semibold">{answers.got_break ? "Yes" : "No"}</dd>
          </div>
          {answers.was_floated && (
            <div className="flex justify-between">
              <dt className="text-slate-400">Floated</dt>
              <dd className="font-semibold">Yes</dd>
            </div>
          )}
        </dl>
      </section>

      {/* (b) private ledger — this device only */}
      {stats && stats.shiftsLogged > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Your ledger <span className="normal-case">· this phone only, never sent</span>
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">{stats.shiftsLogged}</p>
              <p className="mt-1 text-xs text-slate-400">shifts logged</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats.breakRatePct === null ? "—" : `${stats.breakRatePct}%`}
              </p>
              <p className="mt-1 text-xs text-slate-400">break rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.hardestStretch ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-400">hardest stretch this month</p>
            </div>
          </div>
        </section>
      )}

      {/* (c) unit context — only when the 5-response floor is met */}
      {contextLine && (
        <p className="px-1 text-[15px] text-slate-300">✨ {contextLine}</p>
      )}

      {/* you-said-we-did */}
      {latestAction && (
        <section className="rounded-3xl border border-teal-500/20 bg-teal-950/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Your manager acted on this
          </h2>
          <p className="mt-2 text-[17px]">{latestAction.action_text}</p>
          {voted === null ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => vote(true)}
                className="rounded-xl bg-teal-600 py-3 text-[15px] font-semibold text-white"
              >
                Helped
              </button>
              <button
                onClick={() => vote(false)}
                className="rounded-xl bg-white/10 py-3 text-[15px] font-semibold"
              >
                Didn&apos;t help yet
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-teal-300">Noted — anonymously, like everything here.</p>
          )}
        </section>
      )}

      {hasRep && (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-300">
          🤝 Your unit rep sees the same dashboard your manager does.
        </p>
      )}

      <a href="/trust" className="mt-auto text-center text-sm text-slate-500 underline">
        What we collect and what we never do
      </a>
    </div>
  );
}
