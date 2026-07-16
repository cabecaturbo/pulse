"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-ink/20 bg-white px-4 py-3 text-base outline-none focus:border-press dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-ink/20 bg-white px-4 py-3 text-base outline-none focus:border-press dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      {error && <p className="text-sm text-amber-700 dark:text-amber-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-2 rounded-sm bg-press px-4 py-4 text-base font-semibold text-white hover:bg-press-deep disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
