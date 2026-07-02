// POST /api/shorten
//
// This is the Next.js equivalent of the Express `app.post("/shorten", ...)`
// route we wrote earlier. Instead of Express's (req, res), a Route Handler
// receives a standard web `Request` and returns a standard web `Response`.
// We use `NextRequest`/`NextResponse` for a few extra conveniences.
//
// Accepts an optional custom slug and an optional expiry, and rate-limits by
// client IP so a single visitor can't flood the shortener.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDev } from "@/lib/env";
import { generateCode, isValidUrl, isValidSlug } from "@/lib/utils";

// How many times to retry if we randomly generate a code that already exists.
// Collisions are astronomically unlikely, but handling them is correct design.
const MAX_ATTEMPTS = 5;

// Rate limit: at most this many shortens per IP within the window (seconds).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECS = 60;

// Expiry durations we allow the client to pick, in days. Anything else (or 0 /
// omitted) means "never expires". An allowlist keeps a client from asking for
// an absurd or negative duration.
const ALLOWED_EXPIRY_DAYS = new Set([1, 7, 30]);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // Phase 2: shortening requires an account. Reject anonymous requests up front
  // with a 401 — the RLS insert policy would block them anyway, but a clear
  // status lets the client prompt for sign-in.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to create short links." },
      { status: 401 },
    );
  }

  // 0) Rate limit BEFORE doing any work (skipped when IS_DEV=true for local
  //    testing). The client IP arrives in x-forwarded-for; the first entry is
  //    the original client. We fall back to a constant so a missing header
  //    doesn't bypass the limit entirely (all such requests share one bucket).
  if (!isDev()) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

    const { data: allowed, error: rlError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_ip: ip,
        p_max: RATE_LIMIT_MAX,
        p_window_secs: RATE_LIMIT_WINDOW_SECS,
      },
    );

    if (rlError) {
      // Fail closed would block everyone if the limiter breaks; fail open would
      // remove protection. We log and fail OPEN so a limiter hiccup never takes
      // the core feature down — the DB UNIQUE constraint is still a backstop.
      console.error("Rate limit check failed:", rlError);
    } else if (allowed === false) {
      // 429 = "Too Many Requests".
      return NextResponse.json(
        {
          error: "Too many requests — please slow down and try again shortly.",
        },
        { status: 429 },
      );
    }
  }

  // 1) Parse the JSON body. This can throw if the client sends invalid JSON,
  //    so we guard it and return a clean 400 instead of a 500 crash.
  let body: { url?: unknown; slug?: unknown; expiresInDays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const longUrl = body.url;

  // 2) Validate the URL. 400 = "Bad Request": the client did something wrong.
  if (typeof longUrl !== "string" || !isValidUrl(longUrl)) {
    return NextResponse.json(
      { error: "Please provide a valid http(s) URL." },
      { status: 400 },
    );
  }

  // 3) Validate the optional custom slug. Empty string / missing = "generate a
  //    random one for me".
  const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
  const customSlug = rawSlug.length > 0 ? rawSlug : null;
  if (customSlug !== null && !isValidSlug(customSlug)) {
    return NextResponse.json(
      {
        error:
          "Custom links must be 3–16 characters using letters, numbers, - or _, and can't be a reserved word.",
      },
      { status: 400 },
    );
  }

  // 4) Resolve the optional expiry into an absolute timestamp (or null).
  const expiresAt = resolveExpiry(body.expiresInDays);

  // 5a) Custom slug path: a single insert, no retry. If the slug is taken the
  //     UNIQUE constraint fires (Postgres 23505) → 409 Conflict.
  if (customSlug !== null) {
    const { data, error } = await supabase
      .from("urls")
      .insert({
        code: customSlug,
        long_url: longUrl,
        expires_at: expiresAt,
        user_id: user.id,
      })
      .select("code")
      .single();

    if (!error && data) {
      return createdResponse(request, data.code, expiresAt);
    }

    if (error?.code === "23505") {
      // 409 = "Conflict": the resource already exists.
      return NextResponse.json(
        { error: "That custom link is already taken — try another." },
        { status: 409 },
      );
    }

    console.error("Supabase insert failed:", error);
    return NextResponse.json(
      { error: "Something went wrong saving your link." },
      { status: 500 },
    );
  }

  // 5b) Random-code path: insert with collision-retry. Postgres error code
  //     23505 is "unique_violation" — if it fires, we generate a fresh code and
  //     try again.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();

    const { data, error } = await supabase
      .from("urls")
      .insert({
        code,
        long_url: longUrl,
        expires_at: expiresAt,
        user_id: user.id,
      })
      .select("code")
      .single();

    if (!error && data) {
      return createdResponse(request, data.code, expiresAt);
    }

    // If it wasn't a collision, it's a real error — stop and report it.
    if (error && error.code !== "23505") {
      console.error("Supabase insert failed:", error);
      return NextResponse.json(
        { error: "Something went wrong saving your link." },
        { status: 500 },
      );
    }
    // Otherwise it WAS a collision (23505) — loop and try a fresh code.
  }

  // Ran out of attempts — vanishingly unlikely, but we handle it honestly.
  return NextResponse.json(
    { error: "Could not generate a unique code, please try again." },
    { status: 500 },
  );
}

/**
 * Turn the client's `expiresInDays` into an absolute ISO timestamp, or null
 * ("never expires") if it wasn't a value we allow.
 */
function resolveExpiry(value: unknown): string | null {
  if (typeof value !== "number" || !ALLOWED_EXPIRY_DAYS.has(value)) {
    return null;
  }
  return new Date(Date.now() + value * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Build the 201 Created response. `shortUrl` is derived from the request's own
 * origin, so it works on localhost AND on the Vercel domain with zero config.
 */
function createdResponse(
  request: NextRequest,
  code: string,
  expiresAt: string | null,
) {
  const shortUrl = `${request.nextUrl.origin}/${code}`;
  return NextResponse.json({ code, shortUrl, expiresAt }, { status: 201 });
}
