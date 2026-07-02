// PATCH /api/links/[id] — update a link's destination URL.
// DELETE /api/links/[id] — permanently remove a link.
//
// Both require a signed-in user. RLS ensures only the owner can touch the row.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidUrl } from "@/lib/utils";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function parseLinkId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/links/[id]">
) {
  const { id: rawId } = await ctx.params;
  const id = parseLinkId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid link id." }, { status: 400 });
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to edit links." },
      { status: 401 }
    );
  }

  let body: { longUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const longUrl = body.longUrl;
  if (typeof longUrl !== "string" || !isValidUrl(longUrl)) {
    return NextResponse.json(
      { error: "Please provide a valid http(s) URL." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("urls")
    .update({ long_url: longUrl })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, code, long_url")
    .maybeSingle();

  if (error) {
    console.error("Supabase update failed:", error);
    return NextResponse.json(
      { error: "Something went wrong updating your link." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  return NextResponse.json({ link: data });
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/links/[id]">
) {
  const { id: rawId } = await ctx.params;
  const id = parseLinkId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid link id." }, { status: 400 });
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to delete links." },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("urls")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Supabase delete failed:", error);
    return NextResponse.json(
      { error: "Something went wrong deleting your link." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
