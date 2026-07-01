// page.tsx — the homepage. This is a SERVER component (no "use client"), so its
// markup renders to HTML on the server and ships no JavaScript. The only
// interactive part, <ShortenForm/>, is a client island imported below.
//
// NOTE (Next.js 16): `searchParams` is a Promise and must be awaited — the same
// breaking change as `params` in dynamic routes.

import ShortenForm from "./ShortenForm";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ notfound?: string }>;
}) {
  const { notfound } = await searchParams;

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-linear-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
            Snip
          </h1>
          <p className="mt-4 text-lg text-white/60">
            Turn long, ugly links into short, shareable ones.
          </p>
        </div>

        {/* Shown when a redirect couldn't find the code (see [code]/route.ts) */}
        {notfound && (
          <p className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-center text-sm text-amber-300">
            That short link doesn’t exist (or has expired). Try shortening a new
            one below.
          </p>
        )}

        <ShortenForm />

        <p className="mt-10 text-center text-sm text-white/30">
          Built with Next.js · TypeScript · Tailwind · Supabase
        </p>
      </div>
    </main>
  );
}
