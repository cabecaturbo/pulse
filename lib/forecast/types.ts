export interface WeeklyRow {
  week: string; // ISO date (Monday)
  n: number;
  avg_workload: number;
  avg_support: number;
  avg_energy: number;
  break_rate: number; // 0..1
  float_rate: number; // 0..1
}

export interface ShiftWeeklyRow {
  week: string;
  shift_type: "day" | "night";
  n: number;
  avg_workload: number;
  avg_support: number;
  avg_energy: number;
  break_rate: number;
}

export type Severity = "clear" | "gathering" | "storm";

export interface Forecast {
  severity: Severity;
  headline: string;
  focus: string | null;
  /** 0..1 strain used for the ambient gradient */
  strain: number;
}
