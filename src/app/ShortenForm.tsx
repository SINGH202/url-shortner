// ShortenForm.tsx
//
// The "use client" directive marks this as a CLIENT COMPONENT. This is one of
// the most important concepts in the modern Next.js App Router:
//
//   • By default, components are SERVER components — they render to HTML on the
//     server and ship ZERO JavaScript to the browser. Great for static content.
//   • Anything that needs interactivity — useState, onClick, onChange, browser
//     APIs like the clipboard — must be a CLIENT component, opted in with
//     "use client" at the top of the file.
//
// Our page shell (headings, layout) stays a server component; only this small
// interactive island is shipped as JS. That's the server/client boundary.
"use client";

import { useState } from "react";

export default function ShortenForm() {
  const [url, setUrl] = useState("");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser's default full-page form reload
    setLoading(true);
    setError(null);
    setShortUrl(null);
    setCopied(false);

    try {
      // Call our own backend route handler. Same-origin, so no CORS needed.
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        // The server sent a 4xx/5xx with an { error } message — show it.
        setError(data.error ?? "Something went wrong.");
      } else {
        setShortUrl(data.shortUrl);
      }
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/some/very/long/link"
          className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {loading ? "Shortening…" : "Shorten"}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Success state — the result card with copy-to-clipboard */}
      {shortUrl && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3">
          <a
            href={shortUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate font-mono text-indigo-200 hover:text-white transition"
          >
            {shortUrl}
          </a>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
