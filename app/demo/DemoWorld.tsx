"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { forecastUnit } from "@/lib/forecast/engine";
import type { ShiftWeeklyRow, WeeklyRow } from "@/lib/forecast/types";
import { ambientGradient, severityLabel } from "@/components/dashboard/ambient";
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
    return <p className="p-10 text-center text-slate-400">Demo data unavailable.</p>;
  if (!data)
    return <p className="p-10 text-center text-slate-400">Loading the demo world…</p>;

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
    <main className="min-h-dvh bg-slate-950 px-5 pb-16 pt-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
            Live demo · synthetic data
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {data.hospital?.name ?? "Riverbend Medical Center"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Every number below came through the same k-anonymity floor real
            hospitals get: nothing shows for any group under 5 responses. Try
            the nurse side at{" "}
            <Link href="/p/demo-icu" className="text-teal-400 underline">
              /p/demo-icu
            </Link>
            .
          </p>
        </header>

        <div
          className="mb-6 rounded-[1.6rem] border border-amber-400/25 bg-amber-500/10 p-5"
          title={`${stormUnits.length} storm unit(s) × ${data.hospital?.nurses_per_unit ?? 32} nurses × ${Math.round(AT_RISK_SHARE * 100)}% assumed at risk × ${fmtMoney(Number(data.hospital?.replacement_cost ?? 55000))} replacement cost. The ${Math.round(AT_RISK_SHARE * 100)}% is an assumption, calibrated after pilots.`}
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-300">
            Turnover dollars at risk · this quarter
          </p>
          <p className="mt-1 text-3xl font-bold">{fmtMoney(dollars)}</p>
          <p className="mt-1 text-sm text-amber-100/80">
            Concentrated in {stormUnits.length} unit
            {stormUnits.length === 1 ? "" : "s"}:{" "}
            {stormUnits.map((u) => u.unit_name).join(", ") || "—"} · hover for
            the honest math
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {cards.map(({ unit, forecast }) => (
            <div
              key={unit.unit_id}
              className="rounded-[2rem] p-2"
              style={{ background: ambientGradient(forecast.severity) }}
            >
              <div className="rounded-[1.6rem] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{unit.unit_name}</h2>
                  <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium">
                    {severityLabel(forecast.severity)}
                  </span>
                </div>
                <p className="mt-2 text-lg font-medium leading-snug">{forecast.headline}</p>

                {unit.cohort &&
                  unit.cohort.cohort_avg_support < unit.cohort.unit_avg_support - 0.5 && (
                    <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-sm text-amber-200">
                      🐣 New grads trending{" "}
                      {(unit.cohort.unit_avg_support - unit.cohort.cohort_avg_support).toFixed(1)}{" "}
                      below unit average on support
                    </p>
                  )}

                {unit.latest_action && (
                  <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-sm text-teal-200">
                    ✅ &ldquo;{unit.latest_action.text}&rdquo; —{" "}
                    {unit.latest_action.helped} said it helped
                    {forecast.severity === "clear" ? " · unit recovered" : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/trust" className="underline">
            The privacy promise
          </Link>{" "}
          · every screen in this demo respects it
        </p>
      </div>
    </main>
  );
}
