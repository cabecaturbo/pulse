/**
 * The Pulse forecast rules engine. Pure functions, no I/O — everything here
 * is unit-tested. Turns k-anonymity-floored weekly aggregates into a
 * plain-language "unit weather forecast".
 *
 * Weeks below the 5-response floor never reach this module: the database
 * simply doesn't return them, so the engine reasons only over weeks it can
 * legitimately see.
 */
import type { Forecast, Severity, ShiftWeeklyRow, WeeklyRow } from "./types";

/** Composite strain for one week, 0 (serene) .. 1 (crushing). */
export function weekStrain(w: WeeklyRow): number {
  // workload counts up; support & energy count down; missed breaks add strain.
  const scores =
    (w.avg_workload - 1) / 4 +
    (5 - w.avg_support) / 4 +
    (5 - w.avg_energy) / 4;
  const breakPenalty = (1 - w.break_rate) * 0.5;
  return Math.min(1, Math.max(0, (scores / 3) * 0.85 + breakPenalty * 0.3));
}

/** Consecutive weeks (ending at the latest week) a metric has worsened. */
export function worseningStreak(
  weeks: WeeklyRow[],
  metric: (w: WeeklyRow) => number,
  higherIsWorse: boolean
): number {
  let streak = 0;
  for (let i = weeks.length - 1; i > 0; i--) {
    const delta = metric(weeks[i]) - metric(weeks[i - 1]);
    const worse = higherIsWorse ? delta > 0.001 : delta < -0.001;
    if (worse) streak++;
    else break;
  }
  return streak;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Mean of a metric over the trailing `n` weeks (fewer if not available). */
export function trailing(
  weeks: WeeklyRow[],
  n: number,
  metric: (w: WeeklyRow) => number
): number | null {
  const slice = weeks.slice(-n);
  if (slice.length === 0) return null;
  return avg(slice.map(metric));
}

/** Delta of trailing-2-week mean vs. the 2 weeks before that. */
export function windowDelta(
  weeks: WeeklyRow[],
  metric: (w: WeeklyRow) => number
): number | null {
  if (weeks.length < 4) return null;
  const recent = avg(weeks.slice(-2).map(metric));
  const prior = avg(weeks.slice(-4, -2).map(metric));
  return recent - prior;
}

/** Which shift is hurting more over the last 4 visible weeks, if clear. */
export function strainedShift(rows: ShiftWeeklyRow[]): "day" | "night" | null {
  const recent = rows.slice(-16); // generous window; rows are week+shift grain
  const by = (s: "day" | "night") => recent.filter((r) => r.shift_type === s);
  const strain = (rs: ShiftWeeklyRow[]) =>
    rs.length === 0
      ? null
      : avg(rs.map((r) => (r.avg_workload - 1) / 4 + (5 - r.avg_energy) / 4)) / 2;
  const day = strain(by("day"));
  const night = strain(by("night"));
  if (day === null || night === null) return null;
  if (night - day > 0.08) return "night";
  if (day - night > 0.08) return "day";
  return null;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function forecastUnit(
  weeks: WeeklyRow[],
  shiftRows: ShiftWeeklyRow[] = []
): Forecast {
  if (weeks.length === 0) {
    return {
      severity: "clear",
      headline: "Quiet so far: not enough check-ins yet to read the weather.",
      focus: "Get the QR poster up where breaks happen — nothing shows until 5+ nurses respond.",
      strain: 0.15,
    };
  }

  const latest = weeks[weeks.length - 1];
  const strainNow = trailing(weeks, 2, weekStrain)!;
  const energyStreak = worseningStreak(weeks, (w) => w.avg_energy, false);
  const strainStreak = worseningStreak(weeks, weekStrain, true);
  const breakDelta = windowDelta(weeks, (w) => w.break_rate);
  const floatDelta = windowDelta(weeks, (w) => w.float_rate);
  const shift = strainedShift(shiftRows);
  const shiftLabel = shift ? `${shift}-shift` : "";

  // Severity rules, in order of alarm.
  let severity: Severity = "clear";
  if (
    strainNow >= 0.62 ||
    strainStreak >= 3 ||
    (latest.break_rate <= 0.45 && (breakDelta ?? 0) < -0.05)
  ) {
    severity = "storm";
  } else if (
    strainNow >= 0.45 ||
    strainStreak === 2 ||
    energyStreak >= 2 ||
    (breakDelta !== null && breakDelta < -0.12) ||
    (floatDelta !== null && floatDelta > 0.1)
  ) {
    severity = "gathering";
  }

  // Headline: name the trend, name the shift, give one number.
  const clauses: string[] = [];
  if (strainStreak >= 2) {
    clauses.push(
      `${shiftLabel ? shiftLabel + " " : ""}strain up ${strainStreak} weeks running`
    );
  } else if (energyStreak >= 2) {
    clauses.push(`energy down ${energyStreak} weeks running`);
  }
  if (breakDelta !== null && breakDelta < -0.05) {
    clauses.push(`break rate fell to ${pct(latest.break_rate)}`);
  } else if (latest.break_rate <= 0.5) {
    clauses.push(`only ${pct(latest.break_rate)} getting breaks`);
  }
  if (floatDelta !== null && floatDelta > 0.1) {
    clauses.push(`floating up to ${pct(latest.float_rate)}`);
  }

  let headline: string;
  if (severity === "storm") {
    headline = `Storm building: ${clauses.length ? clauses.join(", ") : `sustained heavy strain (energy ${latest.avg_energy.toFixed(1)}/5)`}.`;
  } else if (severity === "gathering") {
    headline = `Clouds gathering: ${clauses.length ? clauses.join(", ") : "strain edging up on recent shifts"}.`;
  } else {
    // Reuse the streak counter with "up" as the counted direction.
    const energyUp = worseningStreak(weeks, (w) => w.avg_energy, true);
    headline =
      energyUp >= 2
        ? `Clearing: energy up ${energyUp} weeks straight, breaks holding at ${pct(latest.break_rate)}.`
        : `Calm: steady week — energy ${latest.avg_energy.toFixed(1)}/5, ${pct(latest.break_rate)} getting breaks.`;
  }

  // One suggested focus: the worst active driver.
  let focus: string | null = null;
  if (latest.break_rate <= 0.55)
    focus = "Breaks are the lever: protect them on the next schedule and say so out loud.";
  else if (floatDelta !== null && floatDelta > 0.1)
    focus = "Floating is spiking — review float assignments before it reads as abandonment.";
  else if (latest.avg_support <= 2.6)
    focus = "Support is the sore spot: pair new assignments and make charge visible on the floor.";
  else if (latest.avg_workload >= 4)
    focus = "Workload is running hot — check acuity vs. staffing on the heaviest shifts.";

  return { severity, headline, focus, strain: strainNow };
}
