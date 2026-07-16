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
      <main className="mx-auto max-w-2xl bg-mist px-6 py-16 text-ink">
        <h1 className="text-2xl font-semibold">Executive view</h1>
        <p className="mt-3 text-slate-600">
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
    <main className="min-h-dvh bg-mist px-6 pb-16 pt-12 text-ink">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12">
          <div className="masthead-rule" />
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">{hospital.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Resilience by unit, last 4 weeks vs the 4 before. 5-response floor applies.
              </p>
            </div>
            <SignOutButton />
          </div>
        </header>

        <section
          title={`Methodology: ${stormUnits.length} unit(s) in sustained storm (recent energy ≤ 2.8/5 and not improving) × ${hospital.nurses_per_unit} nurses per unit × ${Math.round(AT_RISK_SHARE * 100)}% assumed at elevated attrition risk × ${fmtMoney(Number(hospital.replacement_cost))} replacement cost. The ${Math.round(AT_RISK_SHARE * 100)}% share is an assumption, not a measurement — calibrated after pilots.`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Turnover dollars at risk · this quarter
          </p>
          <p className="mt-1 text-6xl font-semibold tracking-tight text-press-2">
            {fmtMoney(dollars)}
          </p>
          <p className="mt-2 text-[15px] text-slate-600">
            {stormUnits.length === 0
              ? "No units in sustained storm right now."
              : `Concentrated in ${stormUnits.length} unit${stormUnits.length > 1 ? "s" : ""}: ${stormUnits
                  .map((u) => u.unit_name)
                  .join(", ")}. Hover for the honest math.`}
          </p>
        </section>

        <div className="mt-12 flex items-center gap-4 text-sm">
          <span className="text-slate-500">Shift:</span>
          {[
            ["All", "/exec"],
            ["Day", "/exec?shift=day"],
            ["Night", "/exec?shift=night"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className={
                (label === "All" && !shiftFilter) ||
                label.toLowerCase() === shiftFilter
                  ? "font-semibold text-press-deep underline"
                  : "text-slate-600 hover:underline"
              }
            >
              {label}
            </Link>
          ))}
        </div>

        <table className="mt-6 w-full text-left text-[15px]">
          <thead className="text-xs uppercase tracking-[0.1em] text-slate-500">
            <tr className="border-b border-ink/20">
              <th className="py-3 pr-6 font-semibold">Unit</th>
              <th className="py-3 pr-4 font-semibold">Energy</th>
              <th className="py-3 pr-4 font-semibold">Trend</th>
              <th className="py-3 pr-4 font-semibold">Breaks</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {league.map((row) => {
              const delta = trendDelta(row);
              return (
                <tr key={row.unit_id} className="border-t border-ink/10">
                  <td className="py-4 pr-6 font-semibold">
                    {row.unit_name}
                    {best?.unit_id === row.unit_id && (
                      <span className="ml-2 text-xs font-normal italic text-press-deep">
                        strongest
                      </span>
                    )}
                    {mostImproved?.unit_id === row.unit_id &&
                      trendDelta(row)! > 0.15 && (
                        <span className="ml-2 text-xs font-normal italic text-press-deep">
                          most improved
                        </span>
                      )}
                  </td>
                  <td className="py-4 pr-4">{Number(row.recent_energy).toFixed(1)}/5</td>
                  <td className="py-4 pr-4">
                    {delta === null ? (
                      <span className="text-slate-500">new</span>
                    ) : (
                      <span className={delta >= 0 ? "text-press-deep" : "text-pulse-5"}>
                        {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-4">{Math.round(Number(row.recent_break_rate) * 100)}%</td>
                  <td className="py-4 text-right">
                    {isStorming(row) && <span title="sustained storm">⛈</span>}
                  </td>
                </tr>
              );
            })}
            {league.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No units clear the 5-response floor for this filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
