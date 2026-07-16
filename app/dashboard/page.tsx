import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { forecastUnit } from "@/lib/forecast/engine";
import type { ShiftWeeklyRow, WeeklyRow } from "@/lib/forecast/types";
import { ambientGradient, severityLabel } from "@/components/dashboard/ambient";
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
    <main className="min-h-dvh bg-slate-950 px-5 pb-16 pt-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unit forecast</h1>
            <p className="text-sm text-slate-400">Plain language. No charts until you ask.</p>
          </div>
          <SignOutButton />
        </header>

        {cards.length === 0 && (
          <p className="rounded-2xl border border-slate-800 p-6 text-slate-400">
            No units are linked to your account yet. Ask your Pulse admin to
            assign your units.
          </p>
        )}

        <div className="flex flex-col gap-6">
          {cards.map(({ unit, forecast }) => (
            <Link
              key={unit.id}
              href={`/dashboard/unit/${unit.id}`}
              className="block rounded-[2rem] p-2 transition-transform hover:scale-[1.01]"
              style={{ background: ambientGradient(forecast.severity) }}
            >
              <div className="rounded-[1.6rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {unit.name}
                    {unit.repView && (
                      <span className="ml-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                        partnership view
                      </span>
                    )}
                  </h2>
                  <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium">
                    {severityLabel(forecast.severity)}
                  </span>
                </div>
                <p className="mt-3 text-xl font-medium leading-snug">
                  {forecast.headline}
                </p>
                {forecast.focus && (
                  <p className="mt-3 text-sm text-white/70">→ {forecast.focus}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
