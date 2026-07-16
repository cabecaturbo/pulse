import type { WeeklyRow } from "@/lib/forecast/types";

const SERIES: { key: keyof WeeklyRow; label: string; color: string }[] = [
  { key: "avg_energy", label: "Energy", color: "#2dd4bf" },
  { key: "avg_support", label: "Support", color: "#93c5fd" },
  { key: "avg_workload", label: "Workload", color: "#fbbf24" },
];

/** 12-week trend lines as a dependency-free inline SVG. */
export default function TrendLines({ weeks }: { weeks: WeeklyRow[] }) {
  if (weeks.length < 2) {
    return (
      <p className="text-sm text-slate-400">
        Not enough visible weeks yet (each needs 5+ responses).
      </p>
    );
  }

  const W = 640;
  const H = 200;
  const PAD = 24;
  const x = (i: number) => PAD + (i / (weeks.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - 1) / 4) * (H - PAD * 2);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="12 week trends">
        {[1, 2, 3, 4, 5].map((g) => (
          <line
            key={g}
            x1={PAD}
            x2={W - PAD}
            y1={y(g)}
            y2={y(g)}
            stroke="rgba(148,163,184,0.15)"
            strokeWidth="1"
          />
        ))}
        {SERIES.map(({ key, color }) => (
          <polyline
            key={key}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={weeks.map((w, i) => `${x(i)},${y(Number(w[key]))}`).join(" ")}
          />
        ))}
      </svg>
      <div className="mt-1 flex gap-5 text-xs text-slate-400">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
