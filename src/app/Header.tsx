// Header.tsx — a server component nav bar shown on every page. It reads the
// signed-in user from the request cookies and renders the appropriate actions.
// Sign-out is a tiny form that POSTs to the /auth/signout route handler.

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Header() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-slate-950 text-white border-b border-white/5">
      <Link
        href="/"
        className="text-xl font-bold tracking-tight bg-linear-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent"
      >
        Snip
      </Link>

      <nav className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="hidden sm:inline text-white/40">{user.email}</span>
            <Link
              href="/dashboard"
              className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20 transition"
            >
              Dashboard
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 font-medium text-white/60 hover:text-white transition"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-indigo-500 px-3 py-1.5 font-medium hover:bg-indigo-400 transition"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
