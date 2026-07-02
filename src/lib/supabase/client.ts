// supabase/client.ts — the Supabase client for BROWSER code (client
// components like the login form). createBrowserClient stores the session in
// cookies so the server clients and proxy can read it back.
//
// This uses only the PUBLIC env vars (the publishable key), which is safe to
// ship to the browser — RLS is what actually protects the data.
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createBrowserClient(url, key);
}
