// supabase/server.ts — the cookie-aware Supabase client for SERVER code
// (server components, route handlers, and proxy). Unlike the anonymous
// singleton in ../supabase.ts, this client reads the signed-in user's session
// out of the request cookies via @supabase/ssr, so RLS policies keyed on
// auth.uid() work.
//
// A fresh client is created per request because it's bound to that request's
// cookie store — never cache it across requests.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copy .env.example to .env.local and fill in your Supabase values.",
    );
  }
  return { url, key };
}

export async function createSupabaseServerClient() {
  const { url, key } = readEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In a pure Server Component the cookie store is read-only and .set()
        // throws. That's fine: token refresh is handled by proxy.ts, so we can
        // safely swallow the error here.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — ignore.
        }
      },
    },
  });
}
