// supabase.ts — provides the Supabase client our backend uses to talk to
// Postgres. This module must ONLY ever be imported from server-side code
// (route handlers, server components) — never from a "use client" file —
// because it uses the secret service-role key.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// We create the client LAZILY (on first use) rather than at import time.
//
// Why: `next build` imports every route module to analyze it. If we validated
// env vars and created the client at the top level, a missing key would crash
// the *build* — even though the client is only ever needed at request time.
// A cached singleton also means we reuse one client across warm serverless
// invocations instead of constructing a new one on every request.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Fail loudly (only when actually called) if config is missing.
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copy .env.example to .env.local and fill in your Supabase values.",
    );
  }

  // The service-role client BYPASSES Row Level Security — which is exactly why
  // it must stay on the server. If this key reached the browser, anyone could
  // read or wipe the database. We also disable session persistence: there's no
  // logged-in user, and every serverless invocation is stateless.
  client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return client;
}
