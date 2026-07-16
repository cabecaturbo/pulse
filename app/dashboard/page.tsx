import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { forecastUnit } from "@/lib/forecast/engine";
import type { ShiftWeeklyRow, WeeklyRow } from "@/lib/forecast/types";
import { severityLabel, severityTone } from "@/components/dashboard/ambient";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Pulse — unit forecast" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: links }, { data: repLinks }] = await Promise.all([
    supabase.from("manager_units").select("unit_id, units(id, name, join_code)"),
    supabase.from("unit_reps").select("unit_id, units(id, name, join_code)"),
  ]);

  type UnitRow = { id: string; name: string; join_code: string };
  const managed = (links ?? [])
    .map((l) => l.units as unknown as UnitRow)
    .filter(Boolean);
  const repped = (repLinks ?? [])
    .map((l) => l.units as unknown as UnitRow)
    .filter(Boolean)
    .filter((u) => !managed.some((m) => m.id === u.id));
  const units = [
    ...managed.map((u) => ({ ...u, repView: false })),
    ...repped.map((u) => ({ ...u, repView: true })),
  ];

  const cards = await Promise.all(
    units.map(async (unit) => {
      const [{ data: weekly }, { data: shifts }] = await Promise.all([
        supabase.rpc("api_unit_weekly", { p_unit: unit.id, p_weeks: 12 }),
        supabase.rpc("api_unit_shift_split", { p_unit: unit.id, p_weeks: 12 }),
      ]);
      const forecast = forecastUnit(
        (weekly ?? []) as WeeklyRow[],
        (shifts ?? []) as ShiftWeeklyRow[]
      );
      return { unit, forecast };
    })
  );

  return (
    <main className="min-h-dvh bg-mist px-6 pb-16 pt-10 text-ink">
      <div className="mx-auto max-w-2xl">
        <header className="mb-12">
          <div className="masthead-rule" />
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">Unit forecast</h1>
              <p className="mt-1 text-sm text-slate-500">
                Plain language. No charts until you ask.
              </p>
            </div>
            <SignOutButton />
          </div>
        </header>

        {cards.length === 0 && (
          <p className="text-slate-600">
            No units are linked to your account yet. Ask your Pulse admin to
            assign your units.
          </p>
        )}

        <div className="flex flex-col gap-12">
          {cards.map(({ unit, forecast }) => (
            <Link
              key={unit.id}
              href={`/dashboard/unit/${unit.id}`}
              className="group block"
            >
              <p className="flex items-baseline gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
                <span className="text-slate-500">
                  {unit.name}
                  {unit.repView && " · partnership view"}
                </span>
                <span className={severityTone(forecast.severity)}>
                  {severityLabel(forecast.severity)}
                </span>
              </p>
              <h2 className="mt-2 text-2xl font-semibold leading-snug tracking-tight group-hover:underline">
                {forecast.headline}
              </h2>
              {forecast.focus && (
                <p className="mt-2 text-[15px] italic text-slate-600">
                  → {forecast.focus}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
