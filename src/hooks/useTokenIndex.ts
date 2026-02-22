"use client";

import { useState, useEffect } from "react";
import type { IndexToken } from "@/types";
import { STOCK_INDEX } from "@/lib/stockIndex";
import { CRYPTO_FALLBACK } from "@/lib/cryptoFallback";

// Static baseline — available immediately, zero network calls
const STATIC_INDEX: IndexToken[] = [...CRYPTO_FALLBACK, ...STOCK_INDEX];

// Module-level: fetched once per session, shared across all hook instances
let moduleIndex: IndexToken[] = STATIC_INDEX;
let fetchPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Selection history — persists to localStorage across sessions
// Tickers the user has previously selected are boosted in searchIndex.
// ---------------------------------------------------------------------------
const HISTORY_KEY = "cashtag_history";
const selectionHistory = new Map<string, number>();

// Hydrate from localStorage on module load (client-only)
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, number>;
      for (const [ticker, count] of Object.entries(parsed)) {
        selectionHistory.set(ticker, count);
      }
    }
  } catch {
    // ignore
  }
}

/** Call from TweetComposer when the user selects a cashtag suggestion */
export function recordSelection(ticker: string) {
  const count = (selectionHistory.get(ticker) ?? 0) + 1;
  selectionHistory.set(ticker, count);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(Object.fromEntries(selectionHistory)));
  } catch {
    // ignore storage errors
  }
}

export function useTokenIndex(): IndexToken[] {
  const [index, setIndex] = useState<IndexToken[]>(moduleIndex);

  useEffect(() => {
    // Static index is already loaded; fetch live data to supplement it
    if (fetchPromise) {
      fetchPromise.then(() => setIndex(moduleIndex));
      return;
    }
    fetchPromise = fetch("/api/index")
      .then((r) => r.json())
      .then((data: IndexToken[]) => {
        moduleIndex = data;
        setIndex(data);
      })
      .catch(() => {
        fetchPromise = null; // allow retry on error
      });
  }, []);

  return index;
}

/**
 * Globally prominent tickers that should always surface near the top,
 * regardless of user type or prefix length.
 * Covers the tickers that appear most often on financial Twitter.
 */
const TIER1 = new Set([
  // Market indexes & most-traded ETFs
  "SPX", "SPY", "QQQ", "NDX", "VIX", "DIA", "IWM",
  // Mega-cap tech stocks
  "AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "GOOG", "AMZN", "META",
  // Other widely discussed stocks
  "JPM", "BAC", "GS", "COIN", "MSTR", "GME", "PLTR", "AMD",
  // Major crypto
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "USDT", "USDC",
  "TON", "AVAX", "ADA", "LINK", "PEPE", "BONK", "WIF",
]);

/**
 * Search the local index for tickers starting with `cashtag`.
 * Sorting priority (highest first):
 *   1. Previously selected by this user (selection history)
 *   2. Tier-1 global prominence (mega-cap stocks + major crypto)
 *   3. Preferred chain match — only for prefix >= 3
 *   4. User domain type bias — only for prefix >= 3
 * Returns up to 10 candidates for Grok to rank.
 */
// Longest stock ticker in our index (GOOGL = 5). Beyond this, no stock can match.
const MAX_STOCK_TICKER_LEN = 5;

export function searchIndex(
  index: IndexToken[],
  cashtag: string,
  userType?: string,
  preferredChain?: string | null
): IndexToken[] {
  const prefix = cashtag.toUpperCase();
  if (!prefix) return [];

  const skipStocks = prefix.length > MAX_STOCK_TICKER_LEN;

  const results = index.filter((t) => {
    if (skipStocks && t.type === "stock") return false;
    return t.ticker.startsWith(prefix);
  });

  // Short prefixes (1-2 chars) are too ambiguous to apply domain bias.
  // "$AA" could be $AAPL, $AAL, or $AAVE — suppress bias so stocks always appear.
  // Bias kicks in at 3+ chars when the prefix is long enough to signal intent.
  const applyBias = prefix.length >= 3;

  results.sort((a, b) => {
    // 1. Selection history — most-picked floats to top regardless of prefix length
    const histDiff =
      (selectionHistory.get(b.ticker) ?? 0) - (selectionHistory.get(a.ticker) ?? 0);
    if (histDiff !== 0) return histDiff;

    // 2. Tier-1 global prominence — always applied, regardless of prefix length.
    // Ensures AAPL beats AAVE for "$AA", BTC beats obscure tokens for "$B", etc.
    const aTier = TIER1.has(a.ticker) ? 1 : 0;
    const bTier = TIER1.has(b.ticker) ? 1 : 0;
    if (bTier !== aTier) return bTier - aTier;

    if (!applyBias) return 0;

    // 3. Preferred chain boost
    if (preferredChain) {
      const aMatch = a.chain === preferredChain ? 1 : 0;
      const bMatch = b.chain === preferredChain ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
    }

    // 4. User domain type bias
    if (userType === "stock") {
      return (b.type === "stock" ? 1 : 0) - (a.type === "stock" ? 1 : 0);
    }
    if (userType === "crypto") {
      return (b.type === "crypto" ? 1 : 0) - (a.type === "crypto" ? 1 : 0);
    }
    return 0;
  });

  // Deduplicate by ticker after sorting — keeps the highest-priority entry per
  // ticker (chain-preferred for the user). Prevents showing USDC_SOL + USDC_ETH
  // as two separate placeholder rows.
  const seen = new Set<string>();
  return results.filter((t) => {
    if (seen.has(t.ticker)) return false;
    seen.add(t.ticker);
    return true;
  }).slice(0, 10);
}
