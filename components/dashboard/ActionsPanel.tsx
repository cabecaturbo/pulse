"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RankedAction } from "@/lib/forecast/actions";

/**
 * The accountability loop: post what you changed, see whether staff say it
 * helped, and see which past actions actually moved scores.
 */
export default function ActionsPanel({
  unitId,
  ranked,
  readOnly = false,
}: {
  unitId: string;
  ranked: RankedAction[];
  /** Partnership (rep) view: same data, no posting. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("actions").insert({
      unit_id: unitId,
      manager_id: user?.id,
      text: text.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div>
      {readOnly && (
        <p className="mb-3 text-sm italic text-slate-600">
          Partnership view: you see exactly what the unit manager sees.
          Posting actions is the manager&apos;s job.
        </p>
      )}
      <div className={readOnly ? "hidden" : "flex gap-2"}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 140))}
          placeholder="What did you change? Staff will see this. (140 chars)"
          className="flex-1 rounded-sm border border-ink/20 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-slate-500 focus:border-press"
        />
        <button
          onClick={post}
          disabled={busy || !text.trim()}
          className="rounded-sm bg-press px-5 py-3 text-[15px] font-semibold text-mist hover:bg-press-deep disabled:opacity-30"
        >
          Post
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-pulse-5">{error}</p>}

      <ol className="mt-6 space-y-5">
        {ranked.map((a, i) => (
          <li key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-semibold">{a.text}</p>
              {i === 0 && ranked.length > 1 && a.score > 0 && (
                <span className="shrink-0 text-xs italic text-press-deep">
                  moved the needle most
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {new Date(a.created_at).toLocaleDateString()} ·{" "}
              <span className="text-press-deep">{a.helped} helped</span> ·{" "}
              {a.not_helped} didn&apos;t (yet)
              {a.energyDelta !== null && (
                <>
                  {" "}
                  · energy {a.energyDelta > 0 ? "+" : ""}
                  {a.energyDelta} after
                </>
              )}
            </p>
          </li>
        ))}
        {ranked.length === 0 && (
          <p className="text-sm text-slate-500">
            No actions posted yet. When you change something because of a
            forecast, post it — staff see it on their thank-you screen and can
            tell you if it helped.
          </p>
        )}
      </ol>
    </div>
  );
}
