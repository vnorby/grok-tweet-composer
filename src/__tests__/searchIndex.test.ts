import { describe, it, expect, beforeEach } from "vitest";
import { searchIndex, recordSelection } from "@/hooks/useTokenIndex";
import type { IndexToken } from "@/types";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function stock(ticker: string, name = ticker): IndexToken {
  return { ticker, name, type: "stock", chain: null, address: null, exchange: "NYSE" };
}

function crypto(ticker: string, chain: string | null = null, name = ticker): IndexToken {
  return { ticker, name, type: "crypto", chain, address: null, exchange: null };
}

const APPLE   = stock("AAPL", "Apple Inc.");
const AAL     = stock("AAL",  "American Airlines");
const AAVE    = crypto("AAVE", "ETH", "Aave");
const BTC     = crypto("BTC",  null,  "Bitcoin");
const SOL_SOL = crypto("SOL",  "SOL", "Solana");
const SOL_BASE = crypto("SOL", "BASE", "Wrapped SOL on Base");
const USDC_SOL = crypto("USDC", "SOL", "USD Coin (Solana)");
const USDC_ETH = crypto("USDC", "ETH", "USD Coin (Ethereum)");
const BONK    = crypto("BONK", "SOL", "Bonk");
const OBSCURE = crypto("AAXX", null, "Obscure token");

// ---------------------------------------------------------------------------
// Prefix matching
// ---------------------------------------------------------------------------

describe("searchIndex – prefix matching", () => {
  const index = [APPLE, AAL, AAVE, BTC, BONK, OBSCURE];

  it("returns only tokens starting with the prefix", () => {
    const result = searchIndex(index, "AA");
    const tickers = result.map((t) => t.ticker);
    expect(tickers).toContain("AAPL");
    expect(tickers).toContain("AAL");
    expect(tickers).toContain("AAVE");
    expect(tickers).not.toContain("BTC");
  });

  it("returns empty array for empty prefix", () => {
    expect(searchIndex(index, "")).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    const result = searchIndex(index, "aa");
    expect(result.map((t) => t.ticker)).toContain("AAPL");
  });

  it("limits results to 10", () => {
    const big = Array.from({ length: 20 }, (_, i) => crypto(`AA${i}`));
    expect(searchIndex(big, "AA").length).toBeLessThanOrEqual(10);
  });

  it("skips stocks when prefix length exceeds MAX_STOCK_TICKER_LEN (5)", () => {
    const longIndex = [stock("GOOGL"), crypto("GOOGLETOKEN")];
    const result = searchIndex(longIndex, "GOOGLET");
    const tickers = result.map((t) => t.ticker);
    expect(tickers).toContain("GOOGLETOKEN");
    expect(tickers).not.toContain("GOOGL");
  });
});

// ---------------------------------------------------------------------------
// Tier-1 prominence (always beats non-tier-1)
// ---------------------------------------------------------------------------

describe("searchIndex – tier-1 prominence", () => {
  it("AAPL (tier-1) sorts above AAVE (non-tier-1) for prefix AA", () => {
    const index = [AAVE, APPLE, AAL]; // AAVE placed first to confirm sort
    const result = searchIndex(index, "AA");
    expect(result[0].ticker).toBe("AAPL");
  });

  it("BTC (tier-1) sorts above an obscure token for prefix B", () => {
    const obscureB = crypto("BZZZ");
    const result = searchIndex([obscureB, BTC], "B");
    expect(result[0].ticker).toBe("BTC");
  });

  it("tier-1 boost applies regardless of user type", () => {
    // Even for a stock user, BTC (tier-1 crypto) beats an obscure stock
    const niche = stock("BZZZ");
    const result = searchIndex([niche, BTC], "B", "stock");
    expect(result[0].ticker).toBe("BTC");
  });
});

// ---------------------------------------------------------------------------
// Domain bias (prefix >= 3 only)
// ---------------------------------------------------------------------------

describe("searchIndex – domain bias at prefix >= 3", () => {
  const index = [USDC_ETH, USDC_SOL, BONK];

  it("crypto user sees crypto tokens first for 3+ char prefix", () => {
    const result = searchIndex([stock("AAL"), crypto("AAVEX")], "AAV", "crypto");
    expect(result[0].type).toBe("crypto");
  });

  it("stock user sees stock tokens first for 3+ char prefix", () => {
    // Use non-tier-1 tokens so tier-1 boost doesn't override the domain bias signal
    const stk = stock("XYZQ");
    const cry = crypto("XYZP");
    const result = searchIndex([cry, stk], "XYZ", "stock");
    expect(result[0].type).toBe("stock");
  });

  it("no domain bias for prefix < 3 chars — stocks and crypto intermixed", () => {
    // For a crypto user with prefix "AA", AAPL (tier-1 stock) should still appear
    const result = searchIndex([AAVE, APPLE], "AA", "crypto");
    const tickers = result.map((t) => t.ticker);
    expect(tickers).toContain("AAPL");
    expect(tickers).toContain("AAVE");
    // AAPL wins because it's tier-1
    expect(result[0].ticker).toBe("AAPL");
  });
});

// ---------------------------------------------------------------------------
// Preferred chain bias (prefix >= 3)
// ---------------------------------------------------------------------------

describe("searchIndex – preferred chain", () => {
  it("preferred chain floats matching tokens to top at prefix >= 3", () => {
    const index = [USDC_ETH, USDC_SOL];
    const result = searchIndex(index, "USD", "crypto", "SOL");
    expect(result[0].chain).toBe("SOL");
  });

  it("preferred chain has no effect at prefix < 3", () => {
    // Both USDC entries match "US", preferred chain = SOL but bias suppressed
    const index = [USDC_ETH, USDC_SOL];
    const result = searchIndex(index, "US", "crypto", "SOL");
    // Just verify both are returned; order may vary at short prefix
    expect(result.length).toBe(2);
  });

  it("native SOL token not displaced by a BASE version when chain bias is SOL", () => {
    const index = [SOL_BASE, SOL_SOL];
    const result = searchIndex(index, "SOL", "crypto", "SOL");
    // SOL_SOL has matching preferred chain → should come first
    expect(result[0].chain).toBe("SOL");
  });
});

// ---------------------------------------------------------------------------
// Selection history
// ---------------------------------------------------------------------------

describe("searchIndex – selection history", () => {
  it("boosts previously selected ticker regardless of type", () => {
    // OBSCURE is crypto, AAPL is tier-1 stock
    // After selecting OBSCURE, it should surface above AAPL for the same prefix
    // Note: this test depends on module-level history state — run in isolation.
    // We can only test that recordSelection increases relative rank.
    const index = [OBSCURE, APPLE];
    const before = searchIndex(index, "AA").map((t) => t.ticker);
    // AAPL (tier-1) is likely first before any history
    expect(before[0]).toBe("AAPL");

    recordSelection("AAXX");
    recordSelection("AAXX");
    recordSelection("AAXX");

    const after = searchIndex(index, "AA").map((t) => t.ticker);
    expect(after[0]).toBe("AAXX");
  });
});
