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
import { severityLabel, severityTone } from "@/components/dashboard/ambient";

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
    <main className="min-h-dvh bg-mist px-6 pb-16 pt-12 text-ink">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-press-deep hover:underline">
          ← All units
        </Link>

        <header className="mt-6">
          <div className="masthead-rule" />
          <p className="mt-6 flex items-baseline gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
            <span className="text-slate-500">{unit.name}</span>
            <span className={severityTone(forecast.severity)}>
              {severityLabel(forecast.severity)}
            </span>
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-snug tracking-tight">
            {forecast.headline}
          </h1>
        </header>

        {/* New-grad cohort strip (only when both groups clear the floor) */}
        {cohort && cohort.cohort_avg_support < cohort.unit_avg_support && (
          <p className="mt-6 max-w-prose text-[15px] leading-relaxed text-pulse-5">
            🐣 New grads on this unit are trending{" "}
            <strong>
              {(cohort.unit_avg_support - cohort.cohort_avg_support).toFixed(1)} points below
            </strong>{" "}
            unit average on support ({cohort.cohort_n} of {cohort.unit_n} recent check-ins).
            First-year churn is the most expensive churn — worth a check-in of your own.
          </p>
        )}

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            12-week trends
          </h2>
          <div className="mt-4">
            <TrendLines weeks={weekly} />
          </div>
          {latest && (
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                ["Break rate", pct(latest.break_rate)],
                ["Float rate", pct(latest.float_rate)],
                ["Energy", `${latest.avg_energy}/5`],
                ["Responses", `${latest.n} this wk`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-2xl font-semibold tracking-tight">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Which shifts hurt
          </h2>
          <div className="mt-4">
            <ShiftHeatmap rows={shifts} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            What staff are saying <span className="normal-case">· themes, last 4 weeks</span>
          </h2>
          {themes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No comment themes yet — comments only surface from weeks with 5+
              responses.
            </p>
          ) : (
            <ul className="mt-4 space-y-6">
              {themes.map((t) => (
                <li key={t.theme}>
                  <p className="text-[15px] font-semibold">
                    {t.theme} <span className="font-normal text-slate-500">× {t.count}</span>
                  </p>
                  {t.examples.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm italic text-slate-600">
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

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-press-deep">
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
