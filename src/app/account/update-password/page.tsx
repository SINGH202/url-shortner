// /account/update-password — set a new password. Reached two ways:
//   1) From a password-recovery email → /auth/callback exchanges the code for a
//      (recovery) session and forwards here.
//   2) A signed-in user who just wants to change their password.
//
// Either way there must be a session, so this is a protected page: no session →
// back to /login. The actual password write happens in the client island below,
// which calls supabase.auth.updateUser({ password }).

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import UpdatePasswordForm from "./UpdatePasswordForm";

export default async function UpdatePasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No valid session (e.g. the recovery link expired before landing here) →
  // send them to sign in / request a fresh reset.
  if (!user) redirect("/login?error=Your%20reset%20link%20is%20invalid%20or%20has%20expired.%20Please%20request%20a%20new%20one.");

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
            Choose a new password for {user.email}.
          </p>
        </div>

        <UpdatePasswordForm />
      </div>
    </main>
  );
}
