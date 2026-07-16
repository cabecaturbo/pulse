import type { ShiftWeeklyRow } from "@/lib/forecast/types";

/** Which shifts hurt: week x shift grid colored by strain (teal->amber). */
export default function ShiftHeatmap({ rows }: { rows: ShiftWeeklyRow[] }) {
  const weeks = [...new Set(rows.map((r) => r.week))].sort();
  if (weeks.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No shift-level weeks clear the 5-response floor yet.
      </p>
    );
  }

  const cell = (week: string, shift: "day" | "night") => {
    const row = rows.find((r) => r.week === week && r.shift_type === shift);
    if (!row) return { color: "rgba(148,163,184,0.08)", title: "below 5-response floor" };
    const strain =
      ((row.avg_workload - 1) / 4 + (5 - row.avg_energy) / 4 + (1 - row.break_rate)) / 3;
    // teal (calm) -> slate -> amber (strained)
    const stops = ["#0f766e", "#14b8a6", "#64748b", "#d97706", "#b45309"];
    const color = stops[Math.min(4, Math.floor(strain * 5))];
    return {
      color,
      title: `${shift} · energy ${row.avg_energy}, breaks ${Math.round(row.break_rate * 100)}%`,
    };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1">
        <tbody>
          {(["day", "night"] as const).map((shift) => (
            <tr key={shift}>
              <td className="pr-2 text-xs capitalize text-slate-400">{shift}</td>
              {weeks.map((w) => {
                const c = cell(w, shift);
                return (
                  <td key={w} title={c.title}>
                    <div className="h-7 min-w-6 rounded-md" style={{ background: c.color }} />
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td />
            {weeks.map((w) => (
              <td key={w} className="pt-1 text-center text-[10px] text-slate-500">
                {new Date(w).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
