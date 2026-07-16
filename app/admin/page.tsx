import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateUnitForm from "./CreateUnitForm";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Pulse — admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("id, name, units(id, name, join_code)")
    .order("name");

  return (
    <main className="min-h-dvh bg-slate-950 px-5 pb-16 pt-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Setup</h1>
            <p className="text-sm text-slate-400">
              Create units and print their QR posters.
            </p>
          </div>
          <SignOutButton />
        </header>

        {!adminRow && (
          <p className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-950/40 p-4 text-sm text-amber-200">
            Your account isn&apos;t an admin — you can browse but unit creation
            will be rejected by the database.
          </p>
        )}

        {(hospitals ?? []).map((h) => (
          <section key={h.id} className="mb-8">
            <h2 className="text-lg font-semibold">{h.name}</h2>
            <ul className="mt-3 space-y-2">
              {(h.units as { id: string; name: string; join_code: string }[]).map(
                (u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5"
                  >
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-slate-400">
                        /p/{u.join_code}
                      </p>
                    </div>
                    <Link
                      href={`/admin/poster/${u.join_code}`}
                      className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      QR poster →
                    </Link>
                  </li>
                )
              )}
            </ul>
            <div className="mt-3">
              <CreateUnitForm hospitalId={h.id} />
            </div>
          </section>
        ))}

        {(hospitals ?? []).length === 0 && (
          <p className="text-slate-400">
            No hospitals visible to your account.
          </p>
        )}
      </div>
    </main>
  );
}
