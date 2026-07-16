import { describe, expect, it } from "vitest";
import {
  forecastUnit,
  strainedShift,
  trailing,
  weekStrain,
  windowDelta,
  worseningStreak,
} from "@/lib/forecast/engine";
import type { ShiftWeeklyRow, WeeklyRow } from "@/lib/forecast/types";

function wk(over: Partial<WeeklyRow>, week = "2026-06-01"): WeeklyRow {
  return {
    week,
    n: 12,
    avg_workload: 3,
    avg_support: 3.5,
    avg_energy: 3.5,
    break_rate: 0.8,
    float_rate: 0.1,
    ...over,
  };
}

function series(rows: Partial<WeeklyRow>[]): WeeklyRow[] {
  return rows.map((r, i) => wk(r, `2026-0${Math.floor(i / 4) + 4}-${(i % 4) * 7 + 1}`));
}

describe("weekStrain", () => {
  it("is low for a serene week", () => {
    expect(
      weekStrain(wk({ avg_workload: 1.5, avg_support: 4.5, avg_energy: 4.5, break_rate: 0.95 }))
    ).toBeLessThan(0.2);
  });

  it("is high for a crushing week", () => {
    expect(
      weekStrain(wk({ avg_workload: 4.8, avg_support: 1.5, avg_energy: 1.5, break_rate: 0.2 }))
    ).toBeGreaterThan(0.75);
  });

  it("missed breaks add strain at equal scores", () => {
    const rested = weekStrain(wk({ break_rate: 1 }));
    const skipped = weekStrain(wk({ break_rate: 0.2 }));
    expect(skipped).toBeGreaterThan(rested);
  });
});

describe("worseningStreak", () => {
  it("counts consecutive declining energy weeks from the end", () => {
    const weeks = series([
      { avg_energy: 4 },
      { avg_energy: 4.2 },
      { avg_energy: 3.8 },
      { avg_energy: 3.4 },
      { avg_energy: 3.0 },
    ]);
    expect(worseningStreak(weeks, (w) => w.avg_energy, false)).toBe(3);
  });

  it("is zero when the latest week improved", () => {
    const weeks = series([{ avg_energy: 3 }, { avg_energy: 2.5 }, { avg_energy: 3.2 }]);
    expect(worseningStreak(weeks, (w) => w.avg_energy, false)).toBe(0);
  });
});

describe("windowDelta / trailing", () => {
  it("compares the last 2 weeks against the 2 before", () => {
    const weeks = series([
      { break_rate: 0.9 },
      { break_rate: 0.9 },
      { break_rate: 0.6 },
      { break_rate: 0.5 },
    ]);
    expect(windowDelta(weeks, (w) => w.break_rate)).toBeCloseTo(-0.35);
    expect(trailing(weeks, 2, (w) => w.break_rate)).toBeCloseTo(0.55);
  });

  it("returns null with fewer than 4 weeks", () => {
    expect(windowDelta(series([{}, {}, {}]), (w) => w.break_rate)).toBeNull();
  });
});

describe("strainedShift", () => {
  it("names the night shift when nights are hurting", () => {
    const rows: ShiftWeeklyRow[] = [];
    for (let i = 0; i < 4; i++) {
      rows.push({
        week: `2026-06-0${i + 1}`,
        shift_type: "day",
        n: 8,
        avg_workload: 2.5,
        avg_support: 4,
        avg_energy: 4,
        break_rate: 0.9,
      });
      rows.push({
        week: `2026-06-0${i + 1}`,
        shift_type: "night",
        n: 8,
        avg_workload: 4.5,
        avg_support: 2.5,
        avg_energy: 2,
        break_rate: 0.4,
      });
    }
    expect(strainedShift(rows)).toBe("night");
  });
});

describe("forecastUnit", () => {
  it("handles the empty (below-floor) case without inventing weather", () => {
    const f = forecastUnit([]);
    expect(f.severity).toBe("clear");
    expect(f.headline).toMatch(/not enough check-ins/i);
  });

  it("calls a storm on sustained worsening strain with falling breaks", () => {
    const weeks = series([
      { avg_energy: 3.8, avg_workload: 2.8, break_rate: 0.85 },
      { avg_energy: 3.4, avg_workload: 3.2, break_rate: 0.75 },
      { avg_energy: 2.9, avg_workload: 3.7, break_rate: 0.6 },
      { avg_energy: 2.3, avg_workload: 4.3, break_rate: 0.4 },
    ]);
    const f = forecastUnit(weeks);
    expect(f.severity).toBe("storm");
    expect(f.headline).toMatch(/^Storm building/);
    expect(f.headline).toMatch(/3 weeks running/);
    expect(f.headline).toMatch(/40%/);
    expect(f.focus).toMatch(/break/i);
  });

  it("calls gathering clouds on a 2-week slide", () => {
    const weeks = series([
      { avg_energy: 4 },
      { avg_energy: 4 },
      { avg_energy: 3.6 },
      { avg_energy: 3.2 },
    ]);
    const f = forecastUnit(weeks);
    expect(f.severity).toBe("gathering");
    expect(f.headline).toMatch(/^Clouds gathering/);
  });

  it("stays calm on a steady healthy unit", () => {
    const weeks = series([
      { avg_energy: 4, break_rate: 0.9 },
      { avg_energy: 4.1, break_rate: 0.88 },
      { avg_energy: 4, break_rate: 0.92 },
      { avg_energy: 4.05, break_rate: 0.9 },
    ]);
    const f = forecastUnit(weeks);
    expect(f.severity).toBe("clear");
  });

  it("celebrates a genuine recovery", () => {
    const weeks = series([
      { avg_energy: 2.4, break_rate: 0.5 },
      { avg_energy: 2.9, break_rate: 0.7 },
      { avg_energy: 3.4, break_rate: 0.85 },
      { avg_energy: 3.8, break_rate: 0.9 },
    ]);
    const f = forecastUnit(weeks);
    expect(f.severity).toBe("clear");
    expect(f.headline).toMatch(/^Clearing/);
  });

  it("names the hurting shift in the headline when shift data shows it", () => {
    const weeks = series([
      { avg_energy: 3.6, avg_workload: 3.4 },
      { avg_energy: 3.3, avg_workload: 3.6 },
      { avg_energy: 3.0, avg_workload: 3.9 },
      { avg_energy: 2.7, avg_workload: 4.2, break_rate: 0.5 },
    ]);
    const shiftRows: ShiftWeeklyRow[] = weeks.flatMap((w) => [
      {
        week: w.week,
        shift_type: "day" as const,
        n: 6,
        avg_workload: 2.5,
        avg_support: 4,
        avg_energy: 4,
        break_rate: 0.9,
      },
      {
        week: w.week,
        shift_type: "night" as const,
        n: 6,
        avg_workload: 4.6,
        avg_support: 2.2,
        avg_energy: 1.9,
        break_rate: 0.3,
      },
    ]);
    const f = forecastUnit(weeks, shiftRows);
    expect(f.headline).toMatch(/night-shift/);
  });
});
