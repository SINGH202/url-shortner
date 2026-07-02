// CopyLinkButton.tsx — a tiny client island for copy-to-clipboard on a
// dashboard row. The dashboard itself stays a server component; only this
// button ships JS.
"use client";

import { useState } from "react";

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
