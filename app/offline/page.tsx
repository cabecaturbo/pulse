export const metadata = { title: "Pulse — offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-8 text-center text-mist">
      <div className="text-5xl">🌙</div>
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-xs text-base text-slate-400">
        No signal down here. Anything you already submitted is saved on this
        phone and will send itself when you&apos;re back in coverage.
      </p>
    </main>
  );
}
