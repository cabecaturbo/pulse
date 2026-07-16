/**
 * Monday digest: one sentence per unit, the forecast headline, and one
 * suggested focus — emailed so managers never have to open a dashboard.
 *
 * Triggered by pg_cron every Monday 07:00 UTC (see repo docs). Emails send
 * via Resend when RESEND_API_KEY is set; otherwise the digest is logged so
 * the pipeline stays testable without a mail provider.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

interface Week {
  week: string;
  n: number;
  avg_workload: number;
  avg_support: number;
  avg_energy: number;
  break_rate: number;
  float_rate: number;
}
interface UnitDigest {
  unit_name: string;
  weeks: Week[];
}
interface ManagerDigest {
  email: string;
  name: string | null;
  units: UnitDigest[];
}

// Condensed port of lib/forecast/engine.ts — keep the two in sync.
function forecastLine(weeks: Week[]): { headline: string; focus: string | null } {
  if (!weeks.length) {
    return {
      headline: "Quiet: not enough check-ins yet to read the weather.",
      focus: "Nothing shows until 5+ nurses respond — is the QR poster still up?",
    };
  }
  const latest = weeks[weeks.length - 1];
  const strain = (w: Week) =>
    ((w.avg_workload - 1) / 4 + (5 - w.avg_support) / 4 + (5 - w.avg_energy) / 4) / 3;
  let streak = 0;
  for (let i = weeks.length - 1; i > 0; i--) {
    if (strain(weeks[i]) > strain(weeks[i - 1]) + 0.001) streak++;
    else break;
  }
  const recent = weeks.slice(-2).reduce((a, w) => a + strain(w), 0) / Math.min(2, weeks.length);
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  if (recent >= 0.55 || streak >= 3 || latest.break_rate <= 0.45) {
    return {
      headline: `Storm building: strain up ${Math.max(streak, 2)} weeks running, break rate at ${pct(latest.break_rate)}.`,
      focus: "Protect breaks on the next schedule and post it as an action.",
    };
  }
  if (recent >= 0.4 || streak === 2 || latest.break_rate <= 0.6) {
    return {
      headline: `Clouds gathering: energy ${latest.avg_energy}/5, breaks ${pct(latest.break_rate)}.`,
      focus: "Walk the floor on the heaviest shift this week.",
    };
  }
  return {
    headline: `Calm: energy ${latest.avg_energy}/5, ${pct(latest.break_rate)} getting breaks.`,
    focus: null,
  };
}

function renderEmail(m: ManagerDigest): string {
  const lines = m.units.map((u) => {
    const f = forecastLine(u.weeks);
    return `<p style="margin:0 0 14px"><strong>${u.unit_name}</strong><br/>${f.headline}${
      f.focus ? `<br/><em>Focus: ${f.focus}</em>` : ""
    }</p>`;
  });
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px">
    <h2 style="margin:0 0 4px">Your Monday Pulse</h2>
    <p style="color:#666;margin:0 0 18px">One minute, every unit.</p>
    ${lines.join("")}
    <p style="color:#999;font-size:12px">Aggregates only — nothing shown for any group under 5 responses.</p>
  </div>`;
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase.rpc("api_digest_data");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const managers = (data ?? []) as ManagerDigest[];
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const results: Record<string, string> = {};

  for (const m of managers) {
    if (!m.units?.length) continue;
    const html = renderEmail(m);
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("DIGEST_FROM") ?? "Pulse <digest@resend.dev>",
          to: m.email,
          subject: "Your Monday Pulse",
          html,
        }),
      });
      results[m.email] = res.ok ? "sent" : `failed ${res.status}`;
    } else {
      console.log(`[digest] would send to ${m.email}:\n${html}`);
      results[m.email] = "logged (no RESEND_API_KEY)";
    }
  }

  return new Response(JSON.stringify({ managers: results }), {
    headers: { "Content-Type": "application/json" },
  });
});
