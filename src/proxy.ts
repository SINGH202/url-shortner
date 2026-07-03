// proxy.ts — Next.js 16 renamed "middleware" to "proxy" (same mechanism: code
// that runs before a request completes). This is the Supabase SSR token-refresh
// hook: on each matched request it reads the auth cookies, refreshes the
// session if needed, and writes the rotated cookies back onto the response.
//
// Per the Next docs, proxy is for lightweight/optimistic checks, NOT full
// authorization — so the real "are you logged in?" gate lives in the dashboard
// page and the /api/shorten handler (which call getUser() and act on the
// result). Here we only refresh the session and do one cheap optimistic
// redirect for /dashboard.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // If Supabase isn't configured yet, don't block the request — just pass through.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() (not getSession()) revalidates the token with Supabase
  // and triggers the cookie refresh above. Do not run other logic between
  // creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optimistic guard: bounce logged-out visitors away from the protected areas
  // early. The pages re-check server-side, so this is purely a nicety.
  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/account");
  if (!user && isProtected) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

// Only run on the app's real pages. The high-traffic short-link redirect route
// (/[code]) is anonymous and deliberately excluded so it never pays for an auth
// round-trip.
export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/account/:path*"],
};
