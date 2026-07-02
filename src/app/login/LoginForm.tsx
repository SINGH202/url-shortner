// LoginForm.tsx — a client island handling both sign-in and sign-up with
// Supabase email/password auth. On success the session cookie is set by the
// browser client; we then refresh so server components (header, dashboard)
// re-render with the new auth state.
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

function authErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === "over_email_send_rate_limit") {
    return "Supabase email rate limit reached. Wait an hour, or disable “Confirm email” in Supabase → Authentication → Providers → Email for local dev.";
  }
  return error.message;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to send the user after a successful sign-in (set by the proxy guard).
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createSupabaseBrowserClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(authErrorMessage(error));
        setLoading(false);
        return;
      }
      // If the project requires email confirmation, there's no session yet.
      if (!data.session) {
        setNotice(
          "Account created. If email confirmation is enabled, check your inbox — otherwise sign in below.",
        );
        setMode("signin");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(authErrorMessage(error));
        setLoading(false);
        return;
      }
    }

    // Navigate + refresh so the server re-reads the session cookie.
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex rounded-xl border border-white/15 bg-white/5 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-lg py-2 font-medium transition ${
            mode === "signin" ? "bg-indigo-500 text-white" : "text-white/60 hover:text-white"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg py-2 font-medium transition ${
            mode === "signup" ? "bg-indigo-500 text-white" : "text-white/60 hover:text-white"
          }`}
        >
          Sign up
        </button>
      </div>

      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition"
      />
      <input
        type="password"
        required
        minLength={6}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 6 characters)"
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition"
      />

      {error && (
        <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
