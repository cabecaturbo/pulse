"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateUnitForm({ hospitalId }: { hospitalId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().from("units").insert({
      hospital_id: hospitalId,
      name: name.trim(),
      join_code: code.trim().toLowerCase().replace(/\s+/g, "-"),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setCode("");
    router.refresh();
  }

  return (
    <form onSubmit={create} className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Unit name (e.g. 5-East)"
        required
        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-teal-500"
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="join code (e.g. 5east)"
        required
        className="w-40 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-teal-500"
      />
      <button
        disabled={busy}
        className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
      >
        Add unit
      </button>
      {error && <p className="w-full text-sm text-amber-500">{error}</p>}
    </form>
  );
}
