/** Exec-view math, kept pure for testing. */

export interface LeagueRow {
  unit_id: string;
  unit_name: string;
  recent_n: number;
  recent_energy: number;
  prior_energy: number | null;
  recent_break_rate: number;
}

/** Sustained storm: low recent energy that isn't improving. */
export function isStorming(row: LeagueRow): boolean {
  return (
    Number(row.recent_energy) <= 2.8 &&
    (row.prior_energy === null ||
      Number(row.recent_energy) <= Number(row.prior_energy) + 0.05)
  );
}

/**
 * Turnover dollars at risk this quarter.
 * Honest methodology (also shown on hover in the UI): units in sustained
 * storm x nurses per unit x AT_RISK_SHARE of them x replacement cost.
 * AT_RISK_SHARE is an assumption (15%), not a measurement — calibrate after
 * pilots.
 */
export const AT_RISK_SHARE = 0.15;

export function dollarsAtRisk(
  rows: LeagueRow[],
  nursesPerUnit: number,
  replacementCost: number
): { stormUnits: LeagueRow[]; dollars: number } {
  const stormUnits = rows.filter(isStorming);
  const dollars =
    stormUnits.length * nursesPerUnit * AT_RISK_SHARE * replacementCost;
  return { stormUnits, dollars: Math.round(dollars) };
}

export function trendDelta(row: LeagueRow): number | null {
  return row.prior_energy === null
    ? null
    : +(Number(row.recent_energy) - Number(row.prior_energy)).toFixed(2);
}

export const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
