// POST /auth/signout — clears the Supabase session cookies and returns the
// user to the homepage. A route handler (not a page) because signing out is a
// mutation; the header's "Sign out" button posts to it.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  // Clears the auth cookies (the server client writes the removals to the
  // outgoing response via next/headers cookies()).
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
