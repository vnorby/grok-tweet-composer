"use client";

import { useState, FormEvent } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  onLoad: (handle: string) => void;
  loading: boolean;
}

export function UserSelector({ onLoad, loading }: Props) {
  const [handle, setHandle] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = handle.replace(/^@/, "").trim();
    if (trimmed) onLoad(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold select-none"
          style={{ color: "var(--text-secondary)" }}
        >
          @
        </span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Enter X handle"
          maxLength={50}
          className="w-full rounded-full py-2 pl-7 pr-4 text-sm outline-none transition-colors"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--border-focus)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !handle.trim()}
        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-opacity disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#000" }}
      >
        {loading ? <Spinner size={14} /> : null}
        Load
      </button>
    </form>
  );
}
