/**
 * Adversarial k-anonymity tests. These run against the LIVE Supabase project
 * and actively try to defeat the 5-response floor: direct table reads,
 * unauthorized RPCs, subgroup slicing, cohort slicing, comment leaks, and
 * date-window differencing. Every attack must fail.
 *
 * Each run seeds its own throwaway week bucket (a random past ISO week on the
 * dedicated 'ktest' unit) so runs never contaminate each other. Tests are
 * skipped when Supabase env vars are absent (e.g. offline CI).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL ?? "manager@pulse.test";
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD ?? "pulse-dev-2026";

const enabled = Boolean(URL_BASE && ANON_KEY);
const d = describe.skipIf(!enabled);

// A random past ISO week, unique per run: 52..940 weeks back, snapped Monday.
function randomPastWeek(): Date {
  const weeksBack = 52 + Math.floor(Math.random() * 888);
  const t = new Date(Date.now() - weeksBack * 7 * 86400_000);
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - day);
  t.setUTCHours(12, 0, 0, 0);
  return t;
}

const WEEK = randomPastWeek();
const WEEKS_BACK = Math.ceil((Date.now() - WEEK.getTime()) / (7 * 86400_000)) + 2;

let anon: SupabaseClient;
let manager: SupabaseClient;
let unitId: string;

function response(over: Record<string, unknown> = {}) {
  return {
    unit_id: unitId,
    shift_type: "day",
    workload: 3,
    support: 3,
    energy: 3,
    got_break: true,
    was_floated: false,
    is_new_grad: false,
    comment: null,
    created_at: WEEK.toISOString(),
    ...over,
  };
}

async function visibleWeeks(weeks: number) {
  const { data, error } = await manager.rpc("api_unit_weekly", {
    p_unit: unitId,
    p_weeks: weeks,
  });
  expect(error).toBeNull();
  return (data as { week: string; n: number }[]).filter(
    (w) => new Date(w.week).getTime() === new Date(WEEK.toISOString().slice(0, 10)).getTime()
  );
}

beforeAll(async () => {
  anon = createClient(URL_BASE!, ANON_KEY!);
  manager = createClient(URL_BASE!, ANON_KEY!);
  const { error } = await manager.auth.signInWithPassword({
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
  });
  if (error) throw new Error(`test manager sign-in failed: ${error.message}`);

  const { data } = await anon.rpc("api_unit_by_code", { code: "ktest" });
  unitId = data?.[0]?.unit_id;
  if (!unitId) throw new Error("ktest unit missing — see supabase/migrations");
}, 30_000);

d("raw access is physically closed", () => {
  it("anon cannot select pulse_responses at all", async () => {
    const { data, error } = await anon.from("pulse_responses").select("*").limit(1);
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull(); // permission denied, not just empty
  });

  it("an authenticated manager cannot select raw rows either", async () => {
    const { data, error } = await manager.from("pulse_responses").select("*").limit(1);
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("anon cannot call the dashboard aggregate RPCs", async () => {
    const { error } = await anon.rpc("api_unit_weekly", { p_unit: unitId, p_weeks: 12 });
    expect(error).not.toBeNull();
  });
});

d("the 5-response floor holds under attack", () => {
  it("4 responses in a week: the week does not exist via the API", async () => {
    for (let i = 0; i < 4; i++) {
      const { error } = await anon.from("pulse_responses").insert(
        response({ energy: 1, comment: "should never leak" })
      );
      expect(error).toBeNull();
    }
    expect(await visibleWeeks(WEEKS_BACK)).toHaveLength(0);
  }, 30_000);

  it("below-floor comments never surface", async () => {
    const { data, error } = await manager.rpc("api_unit_comments", {
      p_unit: unitId,
      p_weeks: WEEKS_BACK,
    });
    expect(error).toBeNull();
    const leaked = (data as { comment: string }[]).filter(
      (c) => c.comment === "should never leak"
    );
    expect(leaked).toHaveLength(0);
  });

  it("the 5th response makes the week visible with n=5 exactly", async () => {
    const { error } = await anon.from("pulse_responses").insert(
      response({ shift_type: "night", is_new_grad: true })
    );
    expect(error).toBeNull();
    const weeks = await visibleWeeks(WEEKS_BACK);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].n).toBe(5);
  }, 30_000);

  it("shift-type slicing cannot split the group below the floor", async () => {
    // The visible week is 4 day + 1 night — both subgroups under 5.
    const { data, error } = await manager.rpc("api_unit_shift_split", {
      p_unit: unitId,
      p_weeks: WEEKS_BACK,
    });
    expect(error).toBeNull();
    const rows = (data as { week: string }[]).filter(
      (r) => r.week === WEEK.toISOString().slice(0, 10)
    );
    expect(rows).toHaveLength(0);
  });

  it("cohort slicing cannot isolate a small new-grad group", async () => {
    // 1 new-grad of 5 total: cohort side is under the floor.
    const { data, error } = await manager.rpc("api_unit_cohort", {
      p_unit: unitId,
      p_weeks: WEEKS_BACK,
    });
    expect(error).toBeNull();
    expect((data ?? []) as unknown[]).toHaveLength(0);
  });

  it("date-window differencing yields nothing: cutoffs snap to whole weeks", async () => {
    // The same week bucket must be byte-identical no matter which p_weeks
    // window includes it — otherwise two windows could be subtracted to
    // isolate individuals.
    const wide = await visibleWeeks(WEEKS_BACK + 40);
    const narrow = await visibleWeeks(WEEKS_BACK);
    expect(wide).toEqual(narrow);
  });
});
