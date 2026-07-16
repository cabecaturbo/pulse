import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Pulse — sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-8">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        For managers, executives, and admins. Nurses never need an account —
        just scan your unit&apos;s QR code.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
