"use client";

import { useState } from "react";

// ─── Pipeline steps ────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: (
      <span
        className="font-mono font-black text-sm leading-none"
        style={{ color: "var(--accent)" }}
      >
        $
      </span>
    ),
    title: "Trigger detected",
    body: "As you type, useCashtagDetection scans back from the cursor. The moment it finds a $ without a space before it, the suggestion engine activates.",
    tag: null,
    tagColor: "",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Local index",
    body: "A pre-cached list of stocks and multi-chain crypto tokens is searched in-memory. Placeholder suggestions appear before any network request is made.",
    tag: "~0ms",
    tagColor: "#22c55e",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#9f6ef5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" strokeWidth="2" stroke="#9f6ef5" fill="none" />
      </svg>
    ),
    title: "Grok + Birdeye — in parallel",
    body: "The server fires two requests concurrently: Grok reads the full tweet and loaded user profile to suggest contextually relevant tickers; Birdeye searches verified on-chain addresses across all supported chains.",
    tag: "300–800ms",
    tagColor: "#9f6ef5",
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
        <path d="M8 6l4-4 4 4M8 18l4 4 4-4M12 2v20" />
      </svg>
    ),
    title: "Filter → backfill → enrich → rank",
    body: "Grok's output is filtered to the typed prefix and deduplicated. Missing addresses are backfilled from the local index. Birdeye fills any remaining gaps. Finally, four ranking signals determine the final order.",
    tag: null,
    tagColor: "",
  },
];

// ─── Ranking signals ───────────────────────────────────────────────────────────

const SIGNALS = [
  {
    n: "1",
    label: "Selection history",
    body: "Tickers you've picked before are persisted to localStorage. They always surface first, regardless of type or chain.",
    color: "#f59e0b",
  },
  {
    n: "2",
    label: "Tier-1 prominence",
    body: "Mega-caps — BTC, ETH, SOL, AAPL, NVDA, MSFT and ~35 others — always rank above obscure tokens. $AA will always show Apple before Aave.",
    color: "#22c55e",
  },
  {
    n: "3",
    label: "Preferred chain",
    body: "Inferred from the loaded user profile. At prefix ≥ 3 characters, tokens on your chain float to the top. Native L1 tokens (SOL on Solana, ETH on Ethereum) are never displaced by bridged versions.",
    color: "#9f6ef5",
  },
  {
    n: "4",
    label: "Domain type",
    body: "Crypto-native users see crypto tokens first; equity traders see stocks first. Only kicks in at prefix ≥ 3 to avoid over-filtering short queries like $AA or $AM.",
    color: "var(--accent)",
  },
];

// ─── Disambiguation example ────────────────────────────────────────────────────

const USDC_ROWS = [
  { chain: "SOL", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8m2r4YaM...", preferred: true },
  { chain: "ETH", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606...", preferred: false },
  { chain: "BASE", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bda0...", preferred: false },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer"
        style={{ background: "transparent" }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            How this engine works
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div
          className="space-y-7 px-4 pb-6 pt-1"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {/* ── Pipeline ─────────────────────────────────────────── */}
          <section className="space-y-3 pt-4">
            <SectionLabel>Suggestion pipeline</SectionLabel>

            {/* Two-track annotation */}
            <div
              className="flex gap-3 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
            >
              <TrackPill color="#22c55e">Instant</TrackPill>
              <span style={{ color: "var(--text-secondary)" }}>
                Local results appear before any API call. Grok and Birdeye enrich them
                asynchronously — latency never blocks the first render.
              </span>
            </div>

            {/* Step timeline */}
            <div className="relative pl-7 space-y-0">
              {/* vertical spine */}
              <div
                className="absolute left-2.5 top-3 bottom-3 w-px"
                style={{ background: "var(--border)" }}
              />

              {STEPS.map((step, i) => (
                <div key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                  {/* dot */}
                  <div
                    className="absolute -left-[18px] w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", top: "2px" }}
                  >
                    {step.icon}
                  </div>

                  {/* content */}
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {step.title}
                      </span>
                      {step.tag && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full leading-none"
                          style={{
                            background: `${step.tagColor}1a`,
                            color: step.tagColor,
                            border: `1px solid ${step.tagColor}33`,
                          }}
                        >
                          {step.tag}
                        </span>
                      )}
                      {i === 1 && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full leading-none"
                          style={{
                            background: "#22c55e1a",
                            color: "#22c55e",
                            border: "1px solid #22c55e33",
                          }}
                        >
                          instant
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Ranking signals ──────────────────────────────────── */}
          <section className="space-y-3">
            <SectionLabel>Ranking signals — applied in priority order</SectionLabel>

            <div className="space-y-2">
              {SIGNALS.map((sig) => (
                <div
                  key={sig.n}
                  className="flex gap-3 rounded-xl px-3 py-3"
                  style={{
                    background: "var(--bg-hover)",
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${sig.color}`,
                  }}
                >
                  <span
                    className="text-xs font-black font-mono shrink-0 w-4 text-right"
                    style={{ color: sig.color, lineHeight: "1.6" }}
                  >
                    {sig.n}
                  </span>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      {sig.label}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {sig.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Disambiguation ───────────────────────────────────── */}
          <section className="space-y-3">
            <SectionLabel>The ticker collision problem</SectionLabel>

            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The same ticker can refer to thousands of different tokens across chains. Volume,
              follower count, and social signals can all be gamed. The token address is the only
              canonical identifier.
            </p>

            {/* USDC example */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }}
              >
                <span
                  className="font-mono font-bold text-sm"
                  style={{ color: "var(--badge-crypto-text)" }}
                >
                  $USDC
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  — same ticker, different tokens
                </span>
              </div>
              <div className="divide-y" style={{ "--tw-divide-opacity": "1" } as React.CSSProperties}>
                {USDC_ROWS.map((row) => (
                  <div
                    key={row.chain}
                    className="flex items-center gap-3 px-3 py-2"
                    style={{
                      background: row.preferred ? "rgba(34,197,94,0.04)" : "transparent",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: "var(--bg-hover)",
                        color: row.preferred ? "#22c55e" : "var(--text-secondary)",
                        border: `1px solid ${row.preferred ? "#22c55e44" : "var(--border)"}`,
                      }}
                    >
                      {row.chain}
                    </span>
                    <span
                      className="text-[11px] font-mono truncate flex-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {row.address}
                    </span>
                    {row.preferred && (
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: "#22c55e" }}
                      >
                        ← SOL user
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div
                className="px-3 py-2 text-xs"
                style={{ color: "var(--text-secondary)", background: "var(--bg-hover)", borderTop: "1px solid var(--border)" }}
              >
                Chain preference (inferred from the loaded profile) resolves which address
                the engine attaches. Birdeye provides the verified canonical address.
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ─── Micro components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-widest"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </p>
  );
}

function TrackPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 self-start mt-0.5 leading-none"
      style={{
        background: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {children}
    </span>
  );
}
