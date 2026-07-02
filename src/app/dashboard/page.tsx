// /dashboard — a signed-in user's links. Server component: it verifies auth
// (the proxy guards optimistically; this is the real check), then lists the
// caller's links. RLS guarantees the query can only ever return rows this user
// owns, but we also filter by user_id for clarity and index use.

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CopyLinkButton from "./CopyLinkButton";
import LinkRowActions from "./LinkRowActions";

type LinkRow = {
  id: number;
  code: string;
  long_url: string;
  clicks: number;
  created_at: string;
  expires_at: string | null;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");

  const { data: links } = await supabase
    .from("urls")
    .select("id, code, long_url, clicks, created_at, expires_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<LinkRow[]>();

  // Build absolute short URLs from the incoming request's host so links are
  // clickable/copyable on any domain.
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const rows = links ?? [];

  return (
    <main className="flex-1 px-6 py-12 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your links</h1>
          <Link
            href="/"
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition"
          >
            + New link
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center text-white/60">
            You haven&apos;t created any links yet.{" "}
            <Link href="/" className="text-indigo-300 hover:text-white">
              Shorten your first one →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((link) => {
              const shortUrl = `${origin}/${link.code}`;
              const expired =
                link.expires_at !== null &&
                new Date(link.expires_at).getTime() <= Date.now();
              return (
                <li
                  key={link.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-mono text-indigo-200 hover:text-white transition"
                    >
                      /{link.code}
                    </a>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
                        {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
                      </span>
                      <CopyLinkButton url={shortUrl} />
                      <Link
                        href={`/dashboard/${link.id}`}
                        className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition"
                      >
                        Analytics
                      </Link>
                    </div>
                  </div>
                  <p className="mt-2 truncate text-sm text-white/40">
                    {link.long_url}
                  </p>
                  <LinkRowActions id={link.id} longUrl={link.long_url} />
                  <p className="mt-1 text-xs text-white/30">
                    Created {new Date(link.created_at).toLocaleDateString()}
                    {link.expires_at &&
                      (expired
                        ? " · expired"
                        : ` · expires ${new Date(
                            link.expires_at,
                          ).toLocaleDateString()}`)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
