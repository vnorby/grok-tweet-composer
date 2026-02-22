"use client";

import { useState, useEffect, useRef } from "react";
import { useDebounce } from "./useDebounce";
import { searchIndex } from "./useTokenIndex";
import type { CashtagSuggestion, SuggestRequest, IndexToken } from "@/types";

// ---------------------------------------------------------------------------
// Module-level result cache — persists across renders, reset on page reload
// ---------------------------------------------------------------------------
const CACHE_TTL = 120_000; // 2 minutes
const resultCache = new Map<string, { suggestions: CashtagSuggestion[]; ts: number }>();

function cacheKey(req: SuggestRequest, chain?: string | null): string {
  return `${req.userType ?? "none"}:${chain ?? "none"}:${req.cashtag.toLowerCase()}`;
}

function getCached(req: SuggestRequest, chain?: string | null): CashtagSuggestion[] | null {
  const key = cacheKey(req, chain);
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    resultCache.delete(key);
    return null;
  }
  return entry.suggestions;
}

function setCached(req: SuggestRequest, suggestions: CashtagSuggestion[], chain?: string | null) {
  resultCache.set(cacheKey(req, chain), { suggestions, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Allow TweetComposer to seed the cache from its pre-warm effect */
export function seedSuggestCache(req: SuggestRequest, suggestions: CashtagSuggestion[], chain?: string | null) {
  if (suggestions.length > 0) setCached(req, suggestions, chain);
}

/** True when every fast result has confidence ≥ 0.8 — skip live X search */
function isHighConfidence(suggestions: CashtagSuggestion[]): boolean {
  if (suggestions.length === 0) return false;
  return suggestions.every((s) => (s.confidence ?? 0) >= 0.8);
}

/**
 * Merge live results into fast results.
 * Fast results keep their order (Grok already ranked these well).
 * Live search only contributes tickers that weren't in the fast results.
 */
function mergeSuggestions(
  fast: CashtagSuggestion[],
  live: CashtagSuggestion[]
): CashtagSuggestion[] {
  const fastTickers = new Set<string>(fast.map((s) => s.ticker));
  const newFromLive = live.filter((s) => !fastTickers.has(s.ticker));
  return [...fast, ...newFromLive].slice(0, 5);
}

/**
 * Convert a local IndexToken to a placeholder CashtagSuggestion.
 * Shown instantly while Grok loads — replaced by Grok's ranked result.
 */
function toPlaceholder(t: IndexToken): CashtagSuggestion {
  return {
    ticker:     t.ticker,
    name:       t.name,
    type:       t.type,
    chain:      (t.chain ?? null) as CashtagSuggestion["chain"],
    reason:     "",
    address:    t.address ?? null,
    exchange:   t.exchange ?? null,
    confidence: 0,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface State {
  suggestions: CashtagSuggestion[];
  loading: boolean;
  liveLoading: boolean;
  error: string | null;
}

export function useGrokSuggest(
  req: SuggestRequest | null,
  active: boolean,
  index: IndexToken[] = [],
  preferredChain?: string | null
): State {
  const [state, setState] = useState<State>({
    suggestions: [],
    loading: false,
    liveLoading: false,
    error: null,
  });

  const fastAbortRef = useRef<AbortController | null>(null);
  const liveAbortRef = useRef<AbortController | null>(null);

  // On each keypress: cancel in-flight requests.
  // Show cached results instantly, or show local candidates as placeholders.
  useEffect(() => {
    if (!active) {
      fastAbortRef.current?.abort();
      liveAbortRef.current?.abort();
      setState({ suggestions: [], loading: false, liveLoading: false, error: null });
      return;
    }
    if (req) {
      fastAbortRef.current?.abort();
      liveAbortRef.current?.abort();
      const cached = getCached(req, preferredChain);
      if (cached) {
        // Stale-while-revalidate: show cached results immediately
        setState({ suggestions: cached, loading: false, liveLoading: false, error: null });
      } else {
        // Show local index candidates instantly while Grok loads
        const candidates = searchIndex(index, req.cashtag, req.userType, preferredChain);
        const placeholders = candidates.slice(0, 5).map(toPlaceholder);
        setState({ suggestions: placeholders, loading: true, liveLoading: true, error: null });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, req, preferredChain]);

  // Adaptive debounce:
  //   50ms  — empty prefix ($ just typed) → near-instant prefetch
  //   200ms — prefix typed → snappy without spamming
  const debounceDelay = req?.cashtag === "" ? 50 : 200;
  const debouncedReq = useDebounce(active ? req : null, debounceDelay);

  useEffect(() => {
    fastAbortRef.current?.abort();
    liveAbortRef.current?.abort();

    if (!debouncedReq) {
      setState({ suggestions: [], loading: false, liveLoading: false, error: null });
      return;
    }

    const fastCtrl = new AbortController();
    const liveCtrl = new AbortController();
    fastAbortRef.current = fastCtrl;
    liveAbortRef.current = liveCtrl;

    // Inject local index candidates so Grok ranks rather than discovers
    const candidates = searchIndex(index, debouncedReq.cashtag, debouncedReq.userType, preferredChain);
    const reqWithCandidates = candidates.length > 0
      ? { ...debouncedReq, candidates }
      : debouncedReq;

    // Fast request — training data, no X search (~500ms–2s with edge runtime)
    fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reqWithCandidates, live: false }),
      signal: fastCtrl.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (fastCtrl.signal.aborted) return;
        const suggestions: CashtagSuggestion[] = data.suggestions ?? [];
        if (suggestions.length > 0) setCached(debouncedReq, suggestions, preferredChain);

        // Skip live X search if Grok is already confident about all results
        const skipLive = isHighConfidence(suggestions);
        if (skipLive) liveCtrl.abort();

        setState((s) => ({
          suggestions: suggestions.length > 0 ? suggestions : s.suggestions,
          loading: false,
          liveLoading: skipLive ? false : s.liveLoading,
          error: data.error ?? null,
        }));
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: "Fast request failed" }));
      });

    // Live request — Grok searches X in real-time (~7-15s)
    // Merges with fast results rather than replacing them.
    fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reqWithCandidates, live: true }),
      signal: liveCtrl.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (liveCtrl.signal.aborted) return;
        const liveSuggestions: CashtagSuggestion[] = data.suggestions ?? [];
        setState((s) => {
          const merged =
            liveSuggestions.length > 0
              ? mergeSuggestions(s.suggestions, liveSuggestions)
              : s.suggestions;
          if (merged.length > 0) setCached(debouncedReq, merged, preferredChain);
          return { suggestions: merged, loading: s.loading, liveLoading: false, error: s.error };
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        // Live failing silently is fine — fast results are already shown
        setState((s) => ({ ...s, liveLoading: false }));
      });

    return () => {
      fastCtrl.abort();
      liveCtrl.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedReq, index, preferredChain]);

  return state;
}
