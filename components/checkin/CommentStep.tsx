"use client";

import { useState } from "react";

/** The margin note: no box, just a hairline that darkens to ink on focus. */
export default function CommentStep({
  onDone,
}: {
  onDone: (comment: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <>
      <h1 className="ed-serif mt-10 text-[34px] font-medium leading-[1.15]">
        Anything else?
      </h1>
      <p
        className="ed-serif mt-3 max-w-[290px] text-[17px] italic"
        style={{ color: "rgba(26,24,21,0.7)", textWrap: "pretty" }}
      >
        A line, if you have one. No names, ever. It reaches your manager as a
        theme, never a quote under five voices.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 120))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={4}
        placeholder="Two call-outs tonight and no float coverage"
        className="ed-serif mt-9 w-full resize-none border-0 border-b bg-transparent p-0 pb-3 text-xl leading-[1.4] text-[#1A1815] outline-none placeholder:text-[rgba(26,24,21,0.35)]"
        style={{
          borderBottom: `1px solid ${focused ? "#1A1815" : "#DDD6C6"}`,
        }}
      />
      <p className="ed-micro mt-2.5" style={{ color: "rgba(26,24,21,0.45)" }}>
        {text.length} / 120
      </p>

      <div className="mt-auto pt-8">
        <button
          onClick={() => {
            navigator.vibrate?.(12);
            onDone(text.trim() ? text.trim() : null);
          }}
          className="ed-serif ed-press-text cursor-pointer border-none bg-transparent p-0 py-3 text-left text-xl text-[#1A1815] underline transition-transform duration-[120ms] ease-out"
          style={{ textUnderlineOffset: "5px", textDecorationThickness: "1px" }}
        >
          {text.trim() ? "send it in" : "send it without a note"}
        </button>
      </div>
    </>
  );
}
