// GET /:code   e.g.  https://yoursite.com/aB3xK9q
//
// This dynamic route is the whole point of a URL shortener: take the short
// code, look up the original URL, and redirect the browser there.
//
// NOTE (Next.js 16 breaking change): in dynamic routes, `params` is now a
// Promise — you must `await` it. `RouteContext<'/[code]'>` is a globally
// available helper that types the params for this exact route.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/[code]">
) {
  const { code } = await ctx.params;
  const supabase = getSupabase();

  // Call our database function, which increments the click counter AND returns
  // the original URL in a single atomic query (see schema.sql).
  const { data: longUrl, error } = await supabase.rpc("resolve_and_click", {
    p_code: code,
  });

  // No matching row → send the visitor back home with a friendly flag, rather
  // than a bare 404. The homepage reads ?notfound and shows a message.
  if (error || !longUrl) {
    return NextResponse.redirect(new URL("/?notfound=1", request.nextUrl.origin));
  }

  // WHY 302 (temporary) and NOT 301 (permanent):
  // Browsers CACHE 301 redirects aggressively — after the first visit they'd
  // skip our server entirely and our click counter would stop incrementing.
  // A 302 makes every click come back through us, so analytics stay accurate.
  return NextResponse.redirect(longUrl as string, 302);
}
