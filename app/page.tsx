import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-12 px-8">
      <header>
        <div className="masthead-rule" />
        <p className="mt-6 text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          The unit weather forecast · anonymous by design
        </p>
        <h1 className="mt-2 text-6xl font-semibold tracking-tight">Pulse</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          A 30-second anonymous shift check-in for hospital nurses — and a
          plain-language weather forecast for the people who staff the unit.
        </p>
      </header>
      <nav className="flex flex-col gap-6 text-lg">
        <Link
          href="/dashboard"
          className="font-semibold text-press-deep hover:underline dark:text-press-sky"
        >
          Manager dashboard →
        </Link>
        <Link
          href="/exec"
          className="font-semibold text-press-deep hover:underline dark:text-press-sky"
        >
          Executive view →
        </Link>
        <Link
          href="/trust"
          className="font-semibold text-press-deep hover:underline dark:text-press-sky"
        >
          Our promise to staff →
        </Link>
      </nav>
      <p className="text-sm italic text-slate-500 dark:text-slate-400">
        Nurses: scan the QR poster on your unit to check in. No login, no
        names, ever.
      </p>
    </main>
  );
}
