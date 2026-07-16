/**
 * Rank a manager's action history by what actually moved scores: the change
 * in unit energy in the 2 visible weeks after the action vs. the 2 before,
 * plus the anonymous helped / didn't-help tally from staff.
 */
import type { WeeklyRow } from "./types";

export interface RankableAction {
  id: string;
  text: string;
  created_at: string;
  helped: number;
  not_helped: number;
}

export interface RankedAction extends RankableAction {
  /** avg energy (2 weeks after) - (2 weeks before); null when either side lacks visible weeks */
  energyDelta: number | null;
  score: number;
}

export function rankActions(
  actions: RankableAction[],
  weekly: WeeklyRow[]
): RankedAction[] {
  const ranked = actions.map((action) => {
    const at = new Date(action.created_at).getTime();
    const before = weekly.filter((w) => {
      const t = new Date(w.week).getTime();
      return t < at && t >= at - 14 * 86400_000;
    });
    const after = weekly.filter((w) => {
      const t = new Date(w.week).getTime();
      return t >= at && t < at + 14 * 86400_000;
    });
    const mean = (rows: WeeklyRow[]) =>
      rows.length ? rows.reduce((a, w) => a + w.avg_energy, 0) / rows.length : null;
    const b = mean(before);
    const a = mean(after);
    const energyDelta = a !== null && b !== null ? +(a - b).toFixed(2) : null;

    const voteScore =
      action.helped + action.not_helped > 0
        ? (action.helped - action.not_helped) /
          (action.helped + action.not_helped)
        : 0;
    const score = (energyDelta ?? 0) * 2 + voteScore;
    return { ...action, energyDelta, score };
  });

  return ranked.sort((x, y) => y.score - x.score);
}
