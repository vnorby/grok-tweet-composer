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
  candidates: IndexToken[] | undefined
): CashtagSuggestion[] {
  if (!candidates?.length) return suggestions;
  const byTicker = new Map(candidates.map((c) => [c.ticker, c]));
  return suggestions.map((s) => {
    const candidate = byTicker.get(s.ticker);
    if (!candidate) return s;
    return {
      ...s,
      // Candidate chain is authoritative — it was chosen with the user's chain
      // preference in mind. Grok's chain can be wrong for multi-chain tokens
      // like USDC where training data skews toward ETH.
      chain: (candidate.chain ?? s.chain ?? null) as CashtagSuggestion["chain"],
      // Only fill address if Grok didn't return one
      address: s.address ?? candidate.address ?? null,
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
