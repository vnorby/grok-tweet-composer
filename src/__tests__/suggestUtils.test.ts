import { describe, it, expect } from "vitest";
import { filterSuggestions, backfillFromCandidates, enrichWithBirdeye } from "@/lib/suggestUtils";
import type { CashtagSuggestion, IndexToken } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function suggestion(overrides: Partial<CashtagSuggestion> = {}): CashtagSuggestion {
  return {
    ticker: "BTC",
    name: "Bitcoin",
    type: "crypto",
    chain: null,
    reason: "test",
    address: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<IndexToken> = {}): IndexToken {
  return {
    ticker: "BTC",
    name: "Bitcoin",
    type: "crypto",
    chain: null,
    address: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// filterSuggestions
// ---------------------------------------------------------------------------

describe("filterSuggestions", () => {
  it("keeps suggestions that start with the prefix", () => {
    const raw = [
      { ticker: "BTC", name: "Bitcoin", type: "crypto", chain: null, reason: "r" },
      { ticker: "ETH", name: "Ethereum", type: "crypto", chain: null, reason: "r" },
    ];
    const result = filterSuggestions(raw, "BT");
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("BTC");
  });

  it("strips leading $ from tickers", () => {
    const raw = [{ ticker: "$BTC", name: "Bitcoin", type: "crypto", chain: null, reason: "r" }];
    const result = filterSuggestions(raw, "BTC");
    expect(result[0].ticker).toBe("BTC");
  });

  it("deduplicates by ticker", () => {
    const raw = [
      { ticker: "BTC", name: "Bitcoin", type: "crypto", chain: null, reason: "a" },
      { ticker: "BTC", name: "Bitcoin 2", type: "crypto", chain: null, reason: "b" },
    ];
    const result = filterSuggestions(raw, "BT");
    expect(result).toHaveLength(1);
  });

  it("limits output to 5 suggestions", () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({
      ticker: `BT${i}`,
      name: `Token ${i}`,
      type: "crypto",
      chain: null,
      reason: "r",
    }));
    const result = filterSuggestions(raw, "BT");
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("drops bare echo: prefix=B, ticker=B (length <= prefix length for short prefixes)", () => {
    const raw = [{ ticker: "B", name: "B token", type: "crypto", chain: null, reason: "r" }];
    const result = filterSuggestions(raw, "B");
    expect(result).toHaveLength(0);
  });

  it("allows full ticker when prefix >= 3 chars (exact match is valid)", () => {
    const raw = [{ ticker: "BTC", name: "Bitcoin", type: "crypto", chain: null, reason: "r" }];
    const result = filterSuggestions(raw, "BTC");
    expect(result[0].ticker).toBe("BTC");
  });

  it("filters out tickers not starting with prefix (2–4 char prefix)", () => {
    const raw = [
      { ticker: "AAPL", name: "Apple", type: "stock", chain: null, reason: "r" },
      { ticker: "AMZN", name: "Amazon", type: "stock", chain: null, reason: "r" },
    ];
    const result = filterSuggestions(raw, "AA");
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("AAPL");
  });

  it("drops items missing a ticker", () => {
    const raw = [{ name: "Bitcoin", type: "crypto", chain: null, reason: "r" }];
    expect(filterSuggestions(raw, "BT")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// backfillFromCandidates
// ---------------------------------------------------------------------------

describe("backfillFromCandidates", () => {
  it("returns suggestions unchanged when no candidates provided", () => {
    const s = suggestion({ ticker: "SOL", chain: null, address: null });
    expect(backfillFromCandidates([s], undefined)).toEqual([s]);
    expect(backfillFromCandidates([s], [])).toEqual([s]);
  });

  it("fills address from candidate when suggestion has none", () => {
    const s = suggestion({ ticker: "SOL", chain: "SOL", address: null });
    const c = candidate({ ticker: "SOL", chain: "SOL", address: "So1111111111" });
    const [result] = backfillFromCandidates([s], [c]);
    expect(result.address).toBe("So1111111111");
  });

  it("does not overwrite an address Grok already provided", () => {
    const s = suggestion({ ticker: "SOL", chain: "SOL", address: "grok-address" });
    const c = candidate({ ticker: "SOL", chain: "SOL", address: "birdeye-address" });
    const [result] = backfillFromCandidates([s], [c]);
    expect(result.address).toBe("grok-address");
  });

  it("candidate chain is authoritative over Grok chain", () => {
    // Grok says ETH, candidate (from user-preference-biased index) says SOL
    const s = suggestion({ ticker: "USDC", chain: "ETH", address: null });
    const c = candidate({ ticker: "USDC", chain: "SOL", address: "EPjFWdd5" });
    const [result] = backfillFromCandidates([s], [c]);
    expect(result.chain).toBe("SOL");
  });

  it("falls back to Grok chain when candidate has no chain", () => {
    const s = suggestion({ ticker: "BTC", chain: "ETH", address: null }); // use a valid chain literal
    const c = candidate({ ticker: "BTC", chain: null, address: null });
    const [result] = backfillFromCandidates([s], [c]);
    expect(result.chain).toBe("ETH"); // falls back to Grok's chain when candidate has none
  });

  it("passes through suggestions with no matching candidate unchanged", () => {
    const s = suggestion({ ticker: "XYZ", chain: null, address: null });
    const c = candidate({ ticker: "BTC", chain: null, address: "addr" });
    const [result] = backfillFromCandidates([s], [c]);
    expect(result).toEqual(s);
  });
});

// ---------------------------------------------------------------------------
// enrichWithBirdeye
// ---------------------------------------------------------------------------

describe("enrichWithBirdeye", () => {
  it("fills address and chain when suggestion has none", () => {
    const s = suggestion({ ticker: "BONK", chain: null, address: null });
    const map = new Map([["BONK", { address: "DezXAZ8z", chain: "SOL" }]]);
    const [result] = enrichWithBirdeye([s], map);
    expect(result.address).toBe("DezXAZ8z");
    expect(result.chain).toBe("SOL");
  });

  it("skips enrichment when Birdeye chain conflicts with known chain", () => {
    // SOL user has SOL USDC; Birdeye returns ETH USDC (highest global volume)
    const s = suggestion({ ticker: "USDC", chain: "SOL", address: null });
    const map = new Map([["USDC", { address: "0xA0b86991c", chain: "ETH" }]]);
    const [result] = enrichWithBirdeye([s], map);
    expect(result.chain).toBe("SOL");
    expect(result.address).toBeNull();
  });

  it("applies enrichment when chains match", () => {
    const s = suggestion({ ticker: "USDC", chain: "SOL", address: null });
    const map = new Map([["USDC", { address: "EPjFWdd5", chain: "SOL" }]]);
    const [result] = enrichWithBirdeye([s], map);
    expect(result.address).toBe("EPjFWdd5");
    expect(result.chain).toBe("SOL");
  });

  it("applies enrichment when suggestion has no chain (Birdeye sets it)", () => {
    const s = suggestion({ ticker: "PEPE", chain: null, address: null });
    const map = new Map([["PEPE", { address: "0x6982508145", chain: "ETH" }]]);
    const [result] = enrichWithBirdeye([s], map);
    expect(result.address).toBe("0x6982508145");
    expect(result.chain).toBe("ETH");
  });

  it("preserves existing address from Grok/backfill, replaced by Birdeye address (Birdeye wins when chains match)", () => {
    const s = suggestion({ ticker: "BONK", chain: "SOL", address: "old-address" });
    const map = new Map([["BONK", { address: "DezXAZ8z", chain: "SOL" }]]);
    const [result] = enrichWithBirdeye([s], map);
    expect(result.address).toBe("DezXAZ8z");
  });

  it("passes through suggestions with no Birdeye match unchanged", () => {
    const s = suggestion({ ticker: "UNKNOWN", chain: "SOL", address: null });
    const map = new Map<string, { address: string; chain: string }>();
    const [result] = enrichWithBirdeye([s], map);
    expect(result).toEqual(s);
  });
});
