// LoginForm.tsx — a client island handling both sign-in and sign-up with
// Supabase email/password auth. On success the session cookie is set by the
// browser client; we then refresh so server components (header, dashboard)
// re-render with the new auth state.
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/utils";

type Mode = "signin" | "signup";

function authErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === "over_email_send_rate_limit") {
    return "Supabase email rate limit reached. Wait an hour, or disable “Confirm email” in Supabase → Authentication → Providers → Email for local dev.";
  }
  return error.message;
}

// Supabase reports an unconfirmed email on sign-in with this error code. Some
// older/self-hosted versions omit the code but use this message, so match both.
function isEmailNotConfirmed(error: { message: string; code?: string }): boolean {
  return (
    error.code === "email_not_confirmed" ||
    /email not confirmed/i.test(error.message)
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to send the user after a successful sign-in (set by the proxy guard).
  // Validated to a local path so a crafted ?redirect=… can't send users offsite.
  const redirectTo = safeInternalPath(searchParams.get("redirect"));

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // An ?error=… lands here from /auth/callback (e.g. an expired reset link) or
  // the update-password gate; show it as the initial error.
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // When set, the last sign-in failed because this email is unverified — we show
  // a "resend verification email" button so the user can recover in place.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    setUnverifiedEmail(null);

    const supabase = createSupabaseBrowserClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(authErrorMessage(error));
        setLoading(false);
        return;
      }
      // If the project requires email confirmation, there's no session yet.
      // `identities` being empty means the email already exists — Supabase hides
      // this to prevent enumeration, but we can still nudge the user to sign in.
      if (!data.session) {
        const alreadyRegistered = data.user?.identities?.length === 0;
        setNotice(
          alreadyRegistered
            ? "That email is already registered. Try signing in — if you never verified it, use the resend option below."
            : `Almost there! We sent a verification link to ${email}. Click it to activate your account, then sign in.`,
        );
        // Offer the resend button in both cases: a brand-new sign-up may need the
        // email re-sent, and an already-registered-but-unverified address relies
        // on it too (the notice above points the user straight at it).
        setUnverifiedEmail(email);
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
        // Email exists but hasn't been verified yet — guide the user instead of
        // showing the raw "Email not confirmed" message.
        if (isEmailNotConfirmed(error)) {
          setError(
            `Your email ${email} hasn’t been verified yet. Check your inbox (and spam) for the verification link, then sign in.`,
          );
          setUnverifiedEmail(email);
          setLoading(false);
          return;
        }
        setError(authErrorMessage(error));
        setLoading(false);
        return;
      }
    }

    // Navigate + refresh so the server re-reads the session cookie.
    router.push(redirectTo);
    router.refresh();
  }

  // Re-send the sign-up confirmation email for an address that was never verified.
  async function handleResendVerification() {
    if (!unverifiedEmail) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unverifiedEmail,
    });

    if (error) {
      setError(authErrorMessage(error));
    } else {
      setNotice(
        `Verification email re-sent to ${unverifiedEmail}. Open the link, then sign in.`,
      );
      setUnverifiedEmail(null);
    }
    setLoading(false);
  }

  // Send a password-reset email. The link lands on /auth/callback, which
  // exchanges the code for a session and forwards to /account/update-password.
  async function handleForgotPassword() {
    setError(null);
    setNotice(null);
    setUnverifiedEmail(null);

    if (!email) {
      setError("Enter your email above, then choose “Forgot password?”.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/update-password`,
    });

    if (error) {
      setError(authErrorMessage(error));
    } else {
      // Always show the same confirmation whether or not the address exists, so
      // this can't be used to probe which emails are registered.
      setNotice(
        `If an account exists for ${email}, we’ve sent a password-reset link. Check your inbox (and spam).`,
      );
    }
    setLoading(false);
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

      {mode === "signin" && (
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={loading}
          className="-mt-1 self-end text-sm text-white/50 hover:text-white underline underline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          Forgot password?
        </button>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          <p>{error}</p>
        </div>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </p>
      )}
      {unverifiedEmail && (
        <button
          type="button"
          onClick={handleResendVerification}
          disabled={loading}
          className="font-semibold text-indigo-300 underline underline-offset-2 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          Resend verification email
        </button>
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
