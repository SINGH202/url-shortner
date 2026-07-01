// POST /api/shorten
//
// This is the Next.js equivalent of the Express `app.post("/shorten", ...)`
// route we wrote earlier. Instead of Express's (req, res), a Route Handler
// receives a standard web `Request` and returns a standard web `Response`.
// We use `NextRequest`/`NextResponse` for a few extra conveniences.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateCode, isValidUrl } from "@/lib/utils";

// How many times to retry if we randomly generate a code that already exists.
// Collisions are astronomically unlikely, but handling them is correct design.
const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  // 1) Parse the JSON body. This can throw if the client sends invalid JSON,
  //    so we guard it and return a clean 400 instead of a 500 crash.
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const longUrl = body.url;

  // 2) Validate input. 400 = "Bad Request": the client did something wrong.
  if (typeof longUrl !== "string" || !isValidUrl(longUrl)) {
    return NextResponse.json(
      { error: "Please provide a valid http(s) URL." },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // 3) Insert with collision-retry. Postgres error code 23505 is
  //    "unique_violation" — it fires if `code` already exists. If so, we simply
  //    generate a new code and try again.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();

    const { data, error } = await supabase
      .from("urls")
      .insert({ code, long_url: longUrl })
      .select("code")
      .single();

    if (!error && data) {
      // Build the absolute short URL from the request's own origin, so this
      // works on localhost AND on your Vercel domain with zero configuration.
      const shortUrl = `${request.nextUrl.origin}/${data.code}`;
      // 201 = "Created": we made a new resource.
      return NextResponse.json({ code: data.code, shortUrl }, { status: 201 });
    }

    // If it wasn't a collision, it's a real error — stop and report it.
    if (error && error.code !== "23505") {
      console.error("Supabase insert failed:", error);
      return NextResponse.json(
        { error: "Something went wrong saving your link." },
        { status: 500 }
      );
    }
    // Otherwise it WAS a collision (23505) — loop and try a fresh code.
  }

  // Ran out of attempts — vanishingly unlikely, but we handle it honestly.
  return NextResponse.json(
    { error: "Could not generate a unique code, please try again." },
    { status: 500 }
  );
}
