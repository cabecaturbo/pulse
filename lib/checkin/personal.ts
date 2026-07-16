/**
 * The nurse's private ledger. Lives in localStorage ONLY — it never touches
 * the server. Keyed per unit code so a float nurse's history stays coherent.
 */
import type { CheckinAnswers } from "./types";

const HISTORY_KEY = "pulse-personal-history";
const COOLDOWN_KEY = "pulse-last-submit";
const VOTED_KEY = "pulse-voted-actions";
export const COOLDOWN_HOURS = 8;

export interface PersonalEntry {
  date: string; // ISO
  workload: number;
  support: number;
  energy: number;
  gotBreak: boolean;
  shiftType: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the ledger is best-effort.
  }
}

export function recordPersonal(answers: CheckinAnswers): void {
  const history = read<PersonalEntry[]>(HISTORY_KEY, []);
  history.push({
    date: new Date().toISOString(),
    workload: answers.workload,
    support: answers.support,
    energy: answers.energy,
    gotBreak: answers.got_break,
    shiftType: answers.shift_type,
  });
  write(HISTORY_KEY, history.slice(-400));
  write(COOLDOWN_KEY, Date.now());
}

export function inCooldown(): boolean {
  const last = read<number>(COOLDOWN_KEY, 0);
  return Date.now() - last < COOLDOWN_HOURS * 3600 * 1000;
}

export interface PersonalStats {
  shiftsLogged: number;
  breakRatePct: number | null;
  /** Lowest-energy run of 3+ consecutive check-ins this month, as a date range label. */
  hardestStretch: string | null;
}

export function personalStats(): PersonalStats {
  const history = read<PersonalEntry[]>(HISTORY_KEY, []);
  const shiftsLogged = history.length;
  const breakRatePct =
    shiftsLogged === 0
      ? null
      : Math.round((history.filter((h) => h.gotBreak).length / shiftsLogged) * 100);

  const now = new Date();
  const thisMonth = history.filter((h) => {
    const d = new Date(h.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  let hardestStretch: string | null = null;
  if (thisMonth.length >= 3) {
    let worst = Infinity;
    let worstStart = 0;
    for (let i = 0; i + 3 <= thisMonth.length; i++) {
      const avg =
        (thisMonth[i].energy + thisMonth[i + 1].energy + thisMonth[i + 2].energy) / 3;
      if (avg < worst) {
        worst = avg;
        worstStart = i;
      }
    }
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    hardestStretch = `${fmt(thisMonth[worstStart].date)}–${fmt(thisMonth[worstStart + 2].date)}`;
  }

  return { shiftsLogged, breakRatePct, hardestStretch };
}

export function hasVotedOnAction(actionId: string): boolean {
  return read<string[]>(VOTED_KEY, []).includes(actionId);
}

export function markVotedOnAction(actionId: string): void {
  const voted = read<string[]>(VOTED_KEY, []);
  if (!voted.includes(actionId)) write(VOTED_KEY, [...voted, actionId].slice(-50));
}
