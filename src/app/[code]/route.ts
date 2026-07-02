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
import type { SupabaseClient } from "@supabase/supabase-js";

async function resolveAndClick(
  supabase: SupabaseClient,
  code: string,
  referrer: string | null,
  country: string | null,
  userAgent: string | null
): Promise<string | null> {
  // Phase 3: four-argument function (analytics). Falls back to the legacy
  // one-argument overload if the database hasn't been migrated yet.
  const withAnalytics = await supabase.rpc("resolve_and_click", {
    p_code: code,
    p_referrer: referrer,
    p_country: country,
    p_user_agent: userAgent,
  });

  if (!withAnalytics.error && withAnalytics.data) {
    return withAnalytics.data as string;
  }

  const legacy = await supabase.rpc("resolve_and_click", { p_code: code });

  if (!legacy.error && legacy.data) {
    return legacy.data as string;
  }

  console.error(
    "resolve_and_click failed:",
    withAnalytics.error ?? legacy.error
  );
  return null;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/[code]">
) {
  const { code } = await ctx.params;
  // The public redirect stays on the anonymous singleton client — it needs no
  // user session, and resolve_and_click() is SECURITY DEFINER so it works for
  // everyone regardless of who owns the link.
  const supabase = getSupabase();

  // Capture analytics (Phase 3) from standard request headers. `referer` is the
  // page the click came from; `x-vercel-ip-country` is set by Vercel's edge
  // (Next 16 removed request.geo/ip, so we read the header directly).
  const referrer = request.headers.get("referer");
  const country = request.headers.get("x-vercel-ip-country");
  const userAgent = request.headers.get("user-agent");

  const longUrl = await resolveAndClick(
    supabase,
    code,
    referrer,
    country,
    userAgent
  );

  // No matching row → send the visitor back home with a friendly flag, rather
  // than a bare 404. The homepage reads ?notfound and shows a message.
  if (!longUrl) {
    return NextResponse.redirect(new URL("/?notfound=1", request.nextUrl.origin));
  }

  // WHY 302 (temporary) and NOT 301 (permanent):
  // Browsers CACHE 301 redirects aggressively — after the first visit they'd
  // skip our server entirely and our click counter would stop incrementing.
  // A 302 makes every click come back through us, so analytics stay accurate.
  return NextResponse.redirect(longUrl as string, 302);
}
