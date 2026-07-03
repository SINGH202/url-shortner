// UpdatePasswordForm.tsx — client island that writes the new password via
// supabase.auth.updateUser(). The session (recovery or normal) is already in
// place by the time this renders, so this is a single authenticated call.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UpdatePasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Confirm client-side so the user isn't surprised by a typo'd password.
    if (password !== confirm) {
      setError("Those passwords don’t match.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Password changed. Land them on the dashboard, signed in with the new
    // credentials; refresh so server components re-read the session.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 6 characters)"
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition"
      />
      <input
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm new password"
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition"
      />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {loading ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
