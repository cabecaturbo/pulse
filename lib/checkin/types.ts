export type ShiftType = "day" | "night";

export interface CheckinAnswers {
  workload: number; // 1-5, 5 = crushing
  support: number; // 1-5, 5 = well supported
  energy: number; // 1-5, 5 = full tank
  got_break: boolean;
  was_floated: boolean;
  is_new_grad: boolean;
  comment: string | null;
  shift_type: ShiftType;
}

export interface UnitInfo {
  unit_id: string;
  unit_name: string;
  hospital_name: string;
  day_shift_start: string;
  night_shift_start: string;
}

export interface UnitWeekContext {
  week: string;
  n: number;
  avg_energy: number;
}

export interface LatestAction {
  action_id: string;
  action_text: string;
  created_at: string;
  helped: number;
  not_helped: number;
}
