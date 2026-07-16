export const metadata = { title: "Pulse — our promise" };

/** Written at an 8th-grade reading level, on purpose. */
export default function TrustPage() {
  return (
    <main className="mx-auto max-w-md px-6 pb-16 pt-12">
      <p className="text-sm font-medium uppercase tracking-widest text-teal-600 dark:text-teal-400">
        The promise
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        How Pulse keeps you anonymous
      </h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="mt-2 space-y-1.5 text-[17px] text-slate-600 dark:text-slate-300">
          <li>• Three numbers: workload, support, energy</li>
          <li>• Two yes/no answers: did you get a break, were you floated</li>
          <li>• A comment, only if you write one (120 letters max)</li>
          <li>• Which unit and which shift (day or night)</li>
        </ul>
        <p className="mt-2 text-[17px] text-slate-600 dark:text-slate-300">
          That&apos;s the whole list.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">What we never collect</h2>
        <ul className="mt-2 space-y-1.5 text-[17px] text-slate-600 dark:text-slate-300">
          <li>• Your name. There is no login for nurses.</li>
          <li>• Your phone or device ID. Nothing about your phone is sent.</li>
          <li>• Anything about patients. Ever.</li>
        </ul>
        <p className="mt-2 text-[17px] text-slate-600 dark:text-slate-300">
          The little stats you see after you check in (your shifts, your break
          rate) live only on your phone. They are never sent anywhere.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">The 5-response rule</h2>
        <p className="mt-2 text-[17px] text-slate-600 dark:text-slate-300">
          Nobody sees anything about any group until at least 5 people in that
          group have answered. Not your manager, not the hospital, not us.
          This rule lives inside the database itself — the screens can&apos;t
          break it even if they tried. If only 4 nurses on your unit answer
          this week, the week shows up as nothing at all.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Same view for your rep</h2>
        <p className="mt-2 text-[17px] text-slate-600 dark:text-slate-300">
          If your unit has a staff or union rep on Pulse, they see the exact
          same dashboard your manager sees. Same numbers, same forecast,
          nothing hidden.
        </p>
      </section>

      <p className="mt-10 text-sm text-slate-400">
        Questions? Ask your manager to show you their screen. That&apos;s
        allowed — it&apos;s all aggregates anyway.
      </p>
    </main>
  );
}
