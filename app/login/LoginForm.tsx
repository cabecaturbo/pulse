"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
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
    // Full navigation, not router.push: client-side RSC navigation right
    // after the auth cookie lands is flaky on iOS Safari / installed PWAs
    // (the push gets cancelled and the form spins forever). A hard
    // navigation re-runs the middleware with the fresh session every time.
    const next = params.get("next") ?? "/dashboard";
    window.location.assign(next.startsWith("/") ? next : "/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="mt-12 flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-ink/20 bg-white px-4 py-3 text-base outline-none focus:border-ink/60 dark:border-slate-700 dark:bg-slate-900"
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
          className="rounded-sm border border-ink/20 bg-white px-4 py-3 text-base outline-none focus:border-ink/60 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      {error && <p className="text-sm text-amber-700 dark:text-amber-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="letterpress rounded-sm bg-ink px-4 py-4 text-base font-semibold text-mist disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
