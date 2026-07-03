// GET /auth/callback — the server-side landing point for Supabase auth links
// that use the PKCE flow (password-recovery emails, and any future magic-link /
// OAuth sign-ins). The email link carries a one-time `code`; we exchange it for
// a real session here — which sets the auth cookies — then forward the user to
// wherever the flow wanted them to land.
//
// Why a route handler and not a page: exchangeCodeForSession() must WRITE the
// session cookies onto the response, and only route handlers / proxy can set
// cookies (a Server Component's cookie store is read-only).

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // `next` is where to send the user once they're signed in. It comes from the
  // URL, so it MUST be sanitised to a local path — otherwise the recovery link
  // could be crafted to bounce the freshly-authenticated user off-site.
  const next = safeInternalPath(
    searchParams.get("next"),
    "/account/update-password",
  );

  // Supabase appends ?error=…&error_description=… when a link is expired, already
  // used, or otherwise invalid. Surface a friendly message on the login page
  // rather than attempting an exchange that will fail.
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");
  if (errorParam) {
    return redirectWithError(origin, errorParam);
  }

  if (!code) {
    return redirectWithError(origin, "That link is missing its security code. Please request a new one.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Most commonly an expired or already-consumed one-time link.
    return redirectWithError(
      origin,
      "This link has expired or was already used. Please request a new one.",
    );
  }

  // Success: cookies are set. Send them on to the (validated) destination.
  return NextResponse.redirect(new URL(next, origin));
}

// Bounce back to /login with a human-readable reason the form can display.
function redirectWithError(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
