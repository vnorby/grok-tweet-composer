"use client";

import type { CashtagSuggestion } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  suggestions: CashtagSuggestion[];
  loading: boolean;
  liveLoading: boolean;
  error: string | null;
  activeIndex: number;
  onSelect: (suggestion: CashtagSuggestion) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function CashtagDropdown({
  suggestions,
  loading,
  liveLoading,
  error,
  activeIndex,
  onSelect,
  anchorRef,
}: Props) {
  const anchor = anchorRef.current;
  const top = anchor
    ? anchor.offsetTop + anchor.offsetHeight + 4
    : 0;

  const isEmpty = !loading && !error && suggestions.length === 0;

  return (
    <div
      role="listbox"
      aria-label="Cashtag suggestions"
      className="absolute z-50 rounded-2xl overflow-hidden"
      style={{
        top,
        left: 0,
        minWidth: 280,
        maxWidth: 360,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {loading && (
        <div className="flex items-center gap-2 px-4 py-3" style={{ color: "var(--text-secondary)" }}>
          <Spinner size={14} />
          <span className="text-sm">Asking Grok…</span>
        </div>
      )}

      {/* Live X search running in background after fast results */}
      {!loading && liveLoading && suggestions.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2" style={{
          color: "var(--text-secondary)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
        }}>
          <Spinner size={10} />
          <span>Searching X live…</span>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-sm" style={{ color: "#ff4757" }}>
          {error}
        </div>
      )}

      {isEmpty && (
        <div className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          No suggestions
        </div>
      )}

      {suggestions.map((s, i) => (
        <div
          key={`${s.ticker}-${i}`}
          role="option"
          aria-selected={i === activeIndex}
          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
          style={{
            background: i === activeIndex ? "var(--bg-hover)" : "transparent",
            borderTop: i === 0 ? "none" : "1px solid var(--border)",
          }}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent textarea blur
            onSelect(s);
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              i === activeIndex ? "var(--bg-hover)" : "transparent";
          }}
        >
          {/* Ticker */}
          <span
            className="text-sm font-bold"
            style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--accent)", minWidth: 48 }}
          >
            ${s.ticker}
          </span>

          {/* Name + reason + address */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {s.name}
              {s.exchange && (
                <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-secondary)" }}>
                  {s.exchange}
                </span>
              )}
            </p>
            {s.reason && (
              <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                {s.reason}
              </p>
            )}
            {s.type === "crypto" && s.address && (
              <p
                className="text-[10px] truncate"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)" }}
              >
                {truncateAddress(s.address)}
              </p>
            )}
          </div>

          {/* Badge */}
          <Badge suggestion={s} />
        </div>
      ))}
    </div>
  );
}
