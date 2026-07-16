"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { forecastUnit } from "@/lib/forecast/engine";
import type { ShiftWeeklyRow, WeeklyRow } from "@/lib/forecast/types";
import { severityLabel, severityTone } from "@/components/dashboard/ambient";
import { dollarsAtRisk, fmtMoney, AT_RISK_SHARE, type LeagueRow } from "@/lib/exec";

interface DemoUnit {
  unit_id: string;
  unit_name: string;
  join_code: string;
  weekly: WeeklyRow[];
  shifts: ShiftWeeklyRow[];
  cohort: {
    cohort_n: number;
    unit_n: number;
    cohort_avg_support: number;
    unit_avg_support: number;
  } | null;
  latest_action: {
    text: string;
    created_at: string;
    helped: number;
    not_helped: number;
  } | null;
}

interface DemoData {
  hospital: { name: string; nurses_per_unit: number; replacement_cost: number } | null;
  units: DemoUnit[];
}

export default function DemoWorld() {
  const [data, setData] = useState<DemoData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/api_demo_data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: "{}",
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed)
    return (
      <p className="bg-mist p-12 text-center text-slate-500">Demo data unavailable.</p>
    );
  if (!data)
    return (
      <p className="bg-mist p-12 text-center text-slate-500">Loading the demo world…</p>
    );

  const units = data.units ?? [];
  const cards = units
    .map((u) => ({ unit: u, forecast: forecastUnit(u.weekly, u.shifts) }))
    .sort((a, b) => b.forecast.strain - a.forecast.strain);

  const league: LeagueRow[] = units.map((u) => {
    const recent = u.weekly.slice(-4);
    const prior = u.weekly.slice(-8, -4);
    const mean = (rows: WeeklyRow[]) =>
      rows.length ? rows.reduce((a, w) => a + Number(w.avg_energy), 0) / rows.length : null;
    return {
      unit_id: u.unit_id,
      unit_name: u.unit_name,
      recent_n: recent.reduce((a, w) => a + w.n, 0),
      recent_energy: mean(recent) ?? 5,
      prior_energy: mean(prior),
      recent_break_rate: recent.length
        ? recent.reduce((a, w) => a + Number(w.break_rate), 0) / recent.length
        : 1,
    };
  });
  const { stormUnits, dollars } = dollarsAtRisk(
    league,
    data.hospital?.nurses_per_unit ?? 32,
    data.hospital?.replacement_cost ?? 55000
  );

  return (
    <main className="min-h-dvh bg-mist px-8 pb-16 pt-12 text-ink">
      <div className="mx-auto max-w-2xl">
        <header>
          <div className="masthead-rule" />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-press-deep">
            Live demo · synthetic data
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {data.hospital?.name ?? "Riverbend Medical Center"}
          </h1>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-slate-600">
            Every number below came through the same k-anonymity floor real
            hospitals get: nothing shows for any group under 5 responses. Try
            the nurse side at{" "}
            <Link href="/p/demo-icu" className="text-press-deep underline">
              /p/demo-icu
            </Link>
            .
          </p>
        </header>

        <section
          className="mt-16"
          title={`${stormUnits.length} storm unit(s) × ${data.hospital?.nurses_per_unit ?? 32} nurses × ${Math.round(AT_RISK_SHARE * 100)}% assumed at risk × ${fmtMoney(Number(data.hospital?.replacement_cost ?? 55000))} replacement cost. The ${Math.round(AT_RISK_SHARE * 100)}% is an assumption, calibrated after pilots.`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Turnover dollars at risk · this quarter
          </p>
          <p className="mt-1 text-6xl font-semibold tracking-tight text-press-2">
            {fmtMoney(dollars)}
          </p>
          <p className="mt-2 text-[15px] text-slate-600">
            Concentrated in {stormUnits.length} unit
            {stormUnits.length === 1 ? "" : "s"}:{" "}
            {stormUnits.map((u) => u.unit_name).join(", ") || "—"} · hover for
            the honest math
          </p>
        </section>

        <div className="mt-16 flex flex-col gap-12">
          {cards.map(({ unit, forecast }) => (
            <article key={unit.unit_id}>
              <p className="flex items-baseline gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
                <span className="text-slate-500">{unit.unit_name}</span>
                <span className={severityTone(forecast.severity)}>
                  {severityLabel(forecast.severity)}
                </span>
              </p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">
                {forecast.headline}
              </h2>

              {unit.cohort &&
                unit.cohort.cohort_avg_support < unit.cohort.unit_avg_support - 0.5 && (
                  <p className="mt-2 text-[15px] text-pulse-5">
                    🐣 New grads trending{" "}
                    {(unit.cohort.unit_avg_support - unit.cohort.cohort_avg_support).toFixed(1)}{" "}
                    below unit average on support
                  </p>
                )}

              {unit.latest_action && (
                <p className="mt-2 text-[15px] italic text-slate-600">
                  ✅ &ldquo;{unit.latest_action.text}&rdquo; —{" "}
                  {unit.latest_action.helped} said it helped
                  {forecast.severity === "clear" ? " · unit recovered" : ""}
                </p>
              )}
            </article>
          ))}
        </div>

        <p className="mt-16 text-center text-sm text-slate-500">
          <Link href="/trust" className="text-press-deep underline">
            The privacy promise
          </Link>{" "}
          · every screen in this demo respects it
        </p>
      </div>
    </main>
  );
}
