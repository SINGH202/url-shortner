// /login — sign in or create an account. Server component: if you're already
// signed in it bounces you to the dashboard; otherwise it renders the client
// LoginForm island.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-3xl font-bold tracking-tight bg-linear-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent"
          >
            Snip
          </Link>
          <p className="mt-2 text-sm text-white/50">
            Sign in to create and manage your links.
          </p>
        </div>

        {/* useSearchParams() in LoginForm needs a Suspense boundary. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
