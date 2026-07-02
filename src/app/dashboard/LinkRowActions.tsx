"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: number;
  longUrl: string;
};

export default function LinkRowActions({ id, longUrl }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(longUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setEditing(false);
    setUrl(longUrl);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longUrl: url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not update link.");
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this link permanently? Analytics for it will also be removed."
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not delete link.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="mt-3 flex flex-col gap-2">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 transition"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium hover:bg-indigo-400 disabled:opacity-60 transition"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </form>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={loading}
        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition"
      >
        Edit URL
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 transition"
      >
        Delete
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
