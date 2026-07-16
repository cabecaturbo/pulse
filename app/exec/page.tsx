import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  dollarsAtRisk,
  fmtMoney,
  isStorming,
  trendDelta,
  AT_RISK_SHARE,
  type LeagueRow,
} from "@/lib/exec";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Pulse — executive view" };
export const dynamic = "force-dynamic";

export default async function ExecPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const { shift } = await searchParams;
  const shiftFilter = shift === "day" || shift === "night" ? shift : null;
  const supabase = await createClient();

  const { data: exec } = await supabase
    .from("executives")
    .select("hospital_id, hospitals(name, nurses_per_unit, replacement_cost)")
    .maybeSingle();

  if (!exec) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-slate-200">
        <h1 className="text-2xl font-bold">Executive view</h1>
        <p className="mt-3 text-slate-400">
          Your account isn&apos;t linked to a hospital as an executive. Ask your
          Pulse admin.
        </p>
      </main>
    );
  }

  const hospital = exec.hospitals as unknown as {
    name: string;
    nurses_per_unit: number;
    replacement_cost: number;
  };

  const { data: leagueRaw } = await supabase.rpc("api_hospital_league", {
    p_hospital: exec.hospital_id,
    p_shift: shiftFilter,
  });
  const league = ((leagueRaw ?? []) as LeagueRow[]).sort(
    (a, b) => Number(b.recent_energy) - Number(a.recent_energy)
  );

  const { stormUnits, dollars } = dollarsAtRisk(
    league,
    hospital.nurses_per_unit,
    hospital.replacement_cost
  );

  const best = league[0];
  const mostImproved = [...league]
    .filter((r) => trendDelta(r) !== null)
    .sort((a, b) => trendDelta(b)! - trendDelta(a)!)[0];

  return (
    <main className="min-h-dvh bg-slate-950 px-5 pb-16 pt-8 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{hospital.name}</h1>
            <p className="text-sm text-slate-400">
              Resilience by unit, last 4 weeks vs the 4 before. 5-response floor applies.
            </p>
          </div>
          <SignOutButton />
        </header>

        <div
          className="rounded-[1.6rem] border border-amber-400/25 bg-amber-500/10 p-6 backdrop-blur-xl"
          title={`Methodology: ${stormUnits.length} unit(s) in sustained storm (recent energy ≤ 2.8/5 and not improving) × ${hospital.nurses_per_unit} nurses per unit × ${Math.round(AT_RISK_SHARE * 100)}% assumed at elevated attrition risk × ${fmtMoney(Number(hospital.replacement_cost))} replacement cost. The ${Math.round(AT_RISK_SHARE * 100)}% share is an assumption, not a measurement — calibrated after pilots.`}
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-300">
            Turnover dollars at risk · this quarter
          </p>
          <p className="mt-2 text-4xl font-bold">{fmtMoney(dollars)}</p>
          <p className="mt-1 text-[15px] text-amber-100/80">
            {stormUnits.length === 0
              ? "No units in sustained storm right now."
              : `Concentrated in ${stormUnits.length} unit${stormUnits.length > 1 ? "s" : ""}: ${stormUnits
                  .map((u) => u.unit_name)
                  .join(", ")}. Hover for the honest math.`}
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-sm">
          <span className="text-slate-400">Shift:</span>
          {[
            ["All", "/exec"],
            ["Day", "/exec?shift=day"],
            ["Night", "/exec?shift=night"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className={`rounded-full px-3.5 py-1 ${
                (label === "All" && !shiftFilter) ||
                label.toLowerCase() === shiftFilter
                  ? "bg-teal-600 text-white"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-white/10">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Unit</th>
                <th className="px-4 py-3">Energy</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3">Breaks</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {league.map((row) => {
                const delta = trendDelta(row);
                return (
                  <tr key={row.unit_id} className="border-t border-white/5">
                    <td className="px-5 py-3.5 font-medium">
                      {row.unit_name}
                      {best?.unit_id === row.unit_id && (
                        <span className="ml-2 rounded-full bg-teal-500/20 px-2 py-0.5 text-xs text-teal-300">
                          strongest
                        </span>
                      )}
                      {mostImproved?.unit_id === row.unit_id &&
                        trendDelta(row)! > 0.15 && (
                          <span className="ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                            most improved
                          </span>
                        )}
                    </td>
                    <td className="px-4 py-3.5">{Number(row.recent_energy).toFixed(1)}/5</td>
                    <td className="px-4 py-3.5">
                      {delta === null ? (
                        <span className="text-slate-500">new</span>
                      ) : (
                        <span className={delta >= 0 ? "text-teal-300" : "text-amber-400"}>
                          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{Math.round(Number(row.recent_break_rate) * 100)}%</td>
                    <td className="px-4 py-3.5 text-right">
                      {isStorming(row) && <span title="sustained storm">⛈</span>}
                    </td>
                  </tr>
                );
              })}
              {league.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No units clear the 5-response floor for this filter yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
