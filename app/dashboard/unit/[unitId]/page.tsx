import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { forecastUnit } from "@/lib/forecast/engine";
import { rankActions } from "@/lib/forecast/actions";
import type { ShiftWeeklyRow, WeeklyRow } from "@/lib/forecast/types";
import { clusterComments } from "@/lib/themes";
import TrendLines from "@/components/dashboard/TrendLines";
import ShiftHeatmap from "@/components/dashboard/ShiftHeatmap";
import ActionsPanel from "@/components/dashboard/ActionsPanel";
import { ambientGradient, severityLabel } from "@/components/dashboard/ambient";

export const metadata = { title: "Pulse — unit detail" };
export const dynamic = "force-dynamic";

const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${Math.round(Number(x) * 100)}%`;

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, name, join_code")
    .eq("id", unitId)
    .single();
  if (!unit) notFound();

  // Unit reps get the identical view, minus the ability to post actions.
  const { data: managerLink } = await supabase
    .from("manager_units")
    .select("unit_id")
    .eq("unit_id", unitId)
    .maybeSingle();
  const readOnly = !managerLink;

  const [
    { data: weeklyRaw },
    { data: shiftRaw },
    { data: cohortRaw },
    { data: commentsRaw },
    { data: actionsRaw },
  ] = await Promise.all([
    supabase.rpc("api_unit_weekly", { p_unit: unitId, p_weeks: 12 }),
    supabase.rpc("api_unit_shift_split", { p_unit: unitId, p_weeks: 12 }),
    supabase.rpc("api_unit_cohort", { p_unit: unitId, p_weeks: 4 }),
    supabase.rpc("api_unit_comments", { p_unit: unitId, p_weeks: 4 }),
    supabase
      .from("actions")
      .select("id, text, created_at, action_feedback(helped)")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false }),
  ]);

  const weekly = (weeklyRaw ?? []) as WeeklyRow[];
  const shifts = (shiftRaw ?? []) as ShiftWeeklyRow[];
  const forecast = forecastUnit(weekly, shifts);
  const latest = weekly[weekly.length - 1];

  const cohort = (cohortRaw ?? [])[0] as
    | { cohort_n: number; unit_n: number; cohort_avg_support: number; unit_avg_support: number }
    | undefined;

  const themes = await clusterComments(
    ((commentsRaw ?? []) as { comment: string }[]).map((c) => c.comment)
  );

  const ranked = rankActions(
    ((actionsRaw ?? []) as {
      id: string;
      text: string;
      created_at: string;
      action_feedback: { helped: boolean }[];
    }[]).map((a) => ({
      id: a.id,
      text: a.text,
      created_at: a.created_at,
      helped: a.action_feedback.filter((f) => f.helped).length,
      not_helped: a.action_feedback.filter((f) => !f.helped).length,
    })),
    weekly
  );

  return (
    <main
      className="min-h-dvh px-5 pb-16 pt-8 text-slate-100"
      style={{ background: ambientGradient(forecast.severity) }}
    >
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">
          ← All units
        </Link>

        <header className="mt-4 rounded-[1.6rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">{unit.name}</h1>
            <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium">
              {severityLabel(forecast.severity)}
            </span>
          </div>
          <p className="mt-2 text-lg">{forecast.headline}</p>
        </header>

        {/* New-grad cohort strip (only when both groups clear the floor) */}
        {cohort && cohort.cohort_avg_support < cohort.unit_avg_support && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-950/40 p-4 text-[15px] backdrop-blur-xl">
            🐣 New grads on this unit are trending{" "}
            <strong>
              {(cohort.unit_avg_support - cohort.cohort_avg_support).toFixed(1)} points below
            </strong>{" "}
            unit average on support ({cohort.cohort_n} of {cohort.unit_n} recent check-ins).
            First-year churn is the most expensive churn — worth a check-in of your own.
          </div>
        )}

        <section className="mt-6 rounded-[1.6rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
            12-week trends
          </h2>
          <div className="mt-3">
            <TrendLines weeks={weekly} />
          </div>
          {latest && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[
                ["Break rate", pct(latest.break_rate)],
                ["Float rate", pct(latest.float_rate)],
                ["Energy", `${latest.avg_energy}/5`],
                ["Responses", `${latest.n} this wk`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-black/20 p-3">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-white/60">{label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-[1.6rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
            Which shifts hurt
          </h2>
          <div className="mt-3">
            <ShiftHeatmap rows={shifts} />
          </div>
        </section>

        <section className="mt-4 rounded-[1.6rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
            What staff are saying <span className="normal-case">· themes, last 4 weeks</span>
          </h2>
          {themes.length === 0 ? (
            <p className="mt-3 text-sm text-white/50">
              No comment themes yet — comments only surface from weeks with 5+
              responses.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {themes.map((t) => (
                <li key={t.theme} className="rounded-xl bg-black/20 p-3">
                  <p className="text-[15px] font-medium">
                    {t.theme} <span className="text-white/50">× {t.count}</span>
                  </p>
                  {t.examples.length > 0 && (
                    <ul className="mt-1.5 space-y-1 text-sm text-white/60">
                      {t.examples.map((e, i) => (
                        <li key={i}>&ldquo;{e}&rdquo;</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-[1.6rem] border border-teal-300/25 bg-teal-500/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-teal-200">
            Actions & receipts <span className="normal-case">· staff see these</span>
          </h2>
          <div className="mt-4">
            <ActionsPanel unitId={unitId} ranked={ranked} readOnly={readOnly} />
          </div>
        </section>
      </div>
    </main>
  );
}
