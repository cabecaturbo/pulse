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
    <main className="min-h-dvh bg-mist px-8 pb-16 pt-12 text-ink">
      <div className="mx-auto max-w-2xl">
        <header className="mb-12">
          <div className="masthead-rule" />
          <div className="mt-6 flex items-baseline justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">Setup</h1>
              <p className="mt-1 text-sm text-slate-500">
                Create units and print their QR posters.
              </p>
            </div>
            <SignOutButton />
          </div>
        </header>

        {!adminRow && (
          <p className="mb-8 max-w-prose text-[15px] text-pulse-5">
            Your account isn&apos;t an admin — you can browse but unit creation
            will be rejected by the database.
          </p>
        )}

        {(hospitals ?? []).map((h) => (
          <section key={h.id} className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight">{h.name}</h2>
            <ul className="mt-6 space-y-6">
              {(h.units as { id: string; name: string; join_code: string }[]).map(
                (u) => (
                  <li key={u.id} className="flex items-baseline justify-between gap-4">
                    <div>
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-sm text-slate-500">/p/{u.join_code}</p>
                    </div>
                    <Link
                      href={`/admin/poster/${u.join_code}`}
                      className="text-sm font-semibold text-press-deep hover:underline"
                    >
                      QR poster →
                    </Link>
                  </li>
                )
              )}
            </ul>
            <div className="mt-4">
              <CreateUnitForm hospitalId={h.id} />
            </div>
          </section>
        ))}

        {(hospitals ?? []).length === 0 && (
          <p className="text-slate-600">No hospitals visible to your account.</p>
        )}
      </div>
    </main>
  );
}
