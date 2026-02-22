import type { CashtagSuggestion, IndexToken } from "@/types";

// ---------------------------------------------------------------------------
// Filter raw Grok output to valid suggestions
// ---------------------------------------------------------------------------
export function filterSuggestions(parsed: unknown[], cashtag: string): CashtagSuggestion[] {
  const prefix = cashtag.toUpperCase();
  const seen = new Set<string>();
  return (parsed as Array<Record<string, unknown>>)
    .filter((s) => {
      if (!s?.ticker || typeof s.ticker !== "string") return false;
      s.ticker = (s.ticker as string).replace(/^\$+/, "").toUpperCase();
      if (prefix.length >= 2 && prefix.length < 5 && !(s.ticker as string).startsWith(prefix)) return false;
      // Only block bare echo for 1-2 char prefixes ($B → B, $BT → BT)
      // For 3+ chars the user may have typed the full ticker ($BIRB → BIRB is valid)
      if (prefix.length <= 2 && (s.ticker as string).length <= prefix.length) return false;
      if (seen.has(s.ticker as string)) return false;
      seen.add(s.ticker as string);
      return true;
    })
    .slice(0, 5) as unknown as CashtagSuggestion[];
}

// ---------------------------------------------------------------------------
// Backfill missing addresses/chains from local index candidates
// ---------------------------------------------------------------------------
export function backfillFromCandidates(
  suggestions: CashtagSuggestion[],
  candidates: IndexToken[] | undefined,
  preferredChain?: string | null
): CashtagSuggestion[] {
  if (!candidates?.length) return suggestions;
  // First-wins: candidates are sorted best-first (chain-preferred first).
  // Using Map insertion order would let later entries overwrite the best match.
  const byTicker = new Map<string, IndexToken>();
  for (const c of candidates) {
    if (!byTicker.has(c.ticker)) byTicker.set(c.ticker, c);
  }
  return suggestions.map((s) => {
    const candidate = byTicker.get(s.ticker);
    if (!candidate) return s;
    // Resolution order:
    // 1. Candidate chain (index was built with chain preference in mind)
    // 2. preferredChain (explicit user preference — overrides Grok's ETH bias
    //    when the static fallback has chain: null)
    // 3. Grok's chain (last resort — training data skews toward ETH)
    const chain = (candidate.chain ?? preferredChain ?? s.chain ?? null) as CashtagSuggestion["chain"];
    // If we changed the chain (Grok had ETH, we're forcing SOL), discard Grok's
    // address — it would be the wrong chain's contract. Use candidate address instead.
    const chainChanged = chain !== s.chain;
    return {
      ...s,
      chain,
      address: chainChanged ? (candidate.address ?? null) : (s.address ?? candidate.address ?? null),
      marketCap: s.marketCap ?? candidate.marketCap ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Enrich suggestions with verified addresses from Birdeye token search
// ---------------------------------------------------------------------------
export function enrichWithBirdeye(
  suggestions: CashtagSuggestion[],
  birdeyeMap: Map<string, { address: string; chain: string }>
): CashtagSuggestion[] {
  return suggestions.map((s) => {
    const birdeye = birdeyeMap.get(s.ticker);
    if (!birdeye) return s;
    // Birdeye sorts by global 24h volume, so for multi-chain tokens like USDC
    // it always returns the highest-volume chain (usually ETH). If we already
    // know the chain (from Grok + candidate backfill), don't override it.
    if (s.chain && birdeye.chain !== s.chain) return s;
    return {
      ...s,
      address: birdeye.address,
      chain: (s.chain ?? birdeye.chain) as CashtagSuggestion["chain"],
    };
  });
}
