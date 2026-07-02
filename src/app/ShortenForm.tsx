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
//
// The QR code is rendered here on the client (qrcode.react draws onto a
// <canvas> in the browser) — the server never runs any QR logic.
"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

// Options for the expiry dropdown. `days: 0` means "never" — the API treats
// anything outside its allowlist (1/7/30) as no expiry.
const EXPIRY_OPTIONS = [
  { label: "Never", days: 0 },
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

export default function ShortenForm() {
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(0);

  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Wraps the QR <canvas> so we can grab it for the "Download PNG" button.
  const qrRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser's default full-page form reload
    setLoading(true);
    setError(null);
    setShortUrl(null);
    setExpiresAt(null);
    setCopied(false);

    try {
      // Call our own backend route handler. Same-origin, so no CORS needed.
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only send slug/expiry when the user actually set them.
        body: JSON.stringify({
          url,
          slug: slug.trim() || undefined,
          expiresInDays: expiresInDays || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // The server sent a 4xx/5xx with an { error } message — show it. This
        // covers 400 (bad url/slug), 409 (slug taken) and 429 (rate limited),
        // each of which already carries a clear message from the API.
        setError(data.error ?? "Something went wrong.");
      } else {
        setShortUrl(data.shortUrl);
        setExpiresAt(data.expiresAt ?? null);
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

  function handleDownloadQr() {
    // qrcode.react renders a real <canvas>; export it to a PNG data URL and
    // trigger a download via a throwaway anchor.
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `snip-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
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
        </div>

        {/* Optional controls: custom slug + expiry */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-1 items-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/40 transition">
            <span className="select-none text-sm text-white/30">/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="custom-link (optional)"
              className="ml-1 w-full bg-transparent text-base outline-none placeholder:text-white/30"
            />
          </div>
          <div className="relative shrink-0 sm:min-w-[11rem]">
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              aria-label="Link expiration"
              className="w-full appearance-none rounded-xl border border-white/15 bg-white/5 py-3 pl-4 pr-10 text-base text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition"
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days} className="bg-slate-900">
                  {opt.label === "Never" ? "Never expires" : `Expires in ${opt.label}`}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/50"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Success state — result card, QR code, and copy-to-clipboard */}
      {shortUrl && (
        <div className="mt-6 rounded-xl border border-indigo-400/25 bg-indigo-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
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

          {expiresAt && (
            <p className="mt-2 text-xs text-white/40">
              Expires {new Date(expiresAt).toLocaleString()}
            </p>
          )}

          <div className="mt-4 flex flex-col items-center gap-3 border-t border-white/10 pt-4">
            {/* White padding around the QR keeps it scannable on the dark card */}
            <div ref={qrRef} className="rounded-lg bg-white p-3">
              <QRCodeCanvas value={shortUrl} size={144} marginSize={0} />
            </div>
            <button
              onClick={handleDownloadQr}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition"
            >
              Download QR (PNG)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
