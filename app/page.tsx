import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Pulse</h1>
        <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
          A 30-second anonymous shift check-in for hospital nurses — and a
          plain-language weather forecast for the people who staff the unit.
        </p>
      </div>
      <nav className="flex flex-col gap-3">
        <Link
          href="/dashboard"
          className="rounded-2xl border border-slate-300/50 px-5 py-4 text-lg font-medium dark:border-slate-700"
        >
          Manager dashboard →
        </Link>
        <Link
          href="/exec"
          className="rounded-2xl border border-slate-300/50 px-5 py-4 text-lg font-medium dark:border-slate-700"
        >
          Executive view →
        </Link>
        <Link
          href="/trust"
          className="rounded-2xl border border-slate-300/50 px-5 py-4 text-lg font-medium dark:border-slate-700"
        >
          Our promise to staff →
        </Link>
      </nav>
      <p className="text-sm text-slate-400">
        Nurses: scan the QR poster on your unit to check in. No login, no
        names, ever.
      </p>
    </main>
  );
}
