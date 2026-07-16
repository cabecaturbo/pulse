"use client";

import { useState } from "react";

export default function CommentStep({
  onDone,
}: {
  onDone: (comment: string | null) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[1.7rem] font-semibold leading-tight">
        Anything else?
      </h1>
      <p className="mt-1 text-[15px] text-slate-400">
        Optional. Anonymous. 120 characters.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 120))}
        rows={4}
        autoFocus={false}
        placeholder="e.g. Two call-outs tonight and no float coverage"
        className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-[17px] text-mist outline-none placeholder:text-slate-500 focus:border-teal-500"
      />
      <p className="mt-2 text-right text-sm text-slate-500">{text.length}/120</p>

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={() => {
            navigator.vibrate?.(12);
            onDone(text.trim() ? text.trim() : null);
          }}
          className="w-full rounded-2xl bg-teal-600 py-4 text-[17px] font-semibold text-white"
        >
          {text.trim() ? "Send it" : "Send without a comment"}
        </button>
      </div>
    </div>
  );
}
