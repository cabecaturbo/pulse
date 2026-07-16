import type { CheckinAnswers, LatestAction, UnitInfo, UnitWeekContext } from "./types";
import { enqueue } from "./outbox";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchUnit(code: string): Promise<UnitInfo | null> {
  const rows = await rpc<UnitInfo[]>("api_unit_by_code", { code });
  return rows?.[0] ?? null;
}

export async function fetchUnitContext(code: string): Promise<UnitWeekContext[]> {
  return (await rpc<UnitWeekContext[]>("api_unit_public_context", { code })) ?? [];
}

export async function fetchLatestAction(code: string): Promise<LatestAction | null> {
  const rows = await rpc<LatestAction[]>("api_latest_action", { code });
  return rows?.[0] ?? null;
}

/**
 * Submit a check-in. Uses plain fetch (not supabase-js) so the exact same
 * request can be queued in IndexedDB and replayed by the service worker when
 * signal comes back. Returns "sent" | "queued".
 */
export async function submitCheckin(
  unitId: string,
  answers: CheckinAnswers
): Promise<"sent" | "queued"> {
  const url = `${URL_BASE}/rest/v1/pulse_responses`;
  const headers = { ...HEADERS, Prefer: "return=minimal" };
  const body = JSON.stringify({ unit_id: unitId, ...answers });

  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (res.ok) return "sent";
    if (res.status >= 500) throw new Error("server error");
    // 4xx: constraint rejection — don't queue garbage, but don't scare the nurse.
    return "sent";
  } catch {
    await enqueue({ url, headers, body });
    return "queued";
  }
}

/** Anonymous action feedback ("helped" / "didn't help yet"). */
export async function submitActionFeedback(actionId: string, helped: boolean): Promise<void> {
  const url = `${URL_BASE}/rest/v1/action_feedback`;
  const headers = { ...HEADERS, Prefer: "return=minimal" };
  const body = JSON.stringify({ action_id: actionId, helped });
  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok && res.status >= 500) throw new Error("server error");
  } catch {
    await enqueue({ url, headers, body });
  }
}
