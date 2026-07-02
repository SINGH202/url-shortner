// /dashboard/[id] — per-link analytics. Server component: verifies auth and
// ownership, pulls the link's click events, aggregates them, and hands plain
// arrays to the Recharts client island.
//
// NOTE (Next.js 16): `params` is a Promise and must be awaited.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AnalyticsCharts, {
  type DailyPoint,
  type Breakdown,
} from "./AnalyticsCharts";

type LinkRow = {
  id: number;
  code: string;
  long_url: string;
  clicks: number;
  created_at: string;
  expires_at: string | null;
};

type EventRow = {
  created_at: string;
  referrer: string | null;
  country: string | null;
};

const DAYS = 14;

// Turn a Referer URL into a readable host label ("Direct" when absent).
function referrerLabel(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

// Build a continuous DAYS-long daily series (zero-filled) ending today.
function buildDaily(events: EventRow[]): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const key = e.created_at.slice(0, 10); // YYYY-MM-DD
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: DailyPoint[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      clicks: counts.get(key) ?? 0,
    });
  }
  return out;
}

// Count occurrences of a key, returning the top N as {label, count}.
function topBreakdown(
  values: (string | null)[],
  labelFor: (v: string | null) => string | null,
  limit = 6,
): Breakdown[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const label = labelFor(v);
    if (label === null) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/${id}`);

  // RLS already restricts this to the caller's own links; the explicit user_id
  // filter is belt-and-suspenders and keeps the query index-friendly.
  const { data: link } = await supabase
    .from("urls")
    .select("id, code, long_url, clicks, created_at, expires_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<LinkRow>();

  if (!link) notFound();

  const { data: events } = await supabase
    .from("click_events")
    .select("created_at, referrer, country")
    .eq("url_id", link.id)
    .order("created_at", { ascending: true })
    .returns<EventRow[]>();

  const rows = events ?? [];
  const daily = buildDaily(rows);
  const referrers = topBreakdown(
    rows.map((e) => e.referrer),
    referrerLabel,
  );
  const countries = topBreakdown(
    rows.map((e) => e.country),
    (c) => c || null, // drop rows with no country
  );

  return (
    <main className="flex-1 px-6 py-12 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm text-white/50 hover:text-white transition"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-4 mb-8">
          <h1 className="font-mono text-2xl font-bold text-indigo-200">
            /{link.code}
          </h1>
          <p className="mt-1 truncate text-sm text-white/40">{link.long_url}</p>
          <p className="mt-3 text-sm text-white/60">
            <span className="font-semibold text-white">{link.clicks}</span> total{" "}
            {link.clicks === 1 ? "click" : "clicks"}
          </p>
        </div>

        <AnalyticsCharts
          daily={daily}
          referrers={referrers}
          countries={countries}
        />
      </div>
    </main>
  );
}
