import { NextResponse } from "next/server";
import type { IndexToken } from "@/types";
import { STOCK_INDEX } from "@/lib/stockIndex";
import { BIRDEYE_CHAIN_MAP } from "@/lib/chains";

// CoinGecko ID → chain abbreviation for tokens we know
const COINGECKO_CHAIN: Record<string, string> = {
  ethereum:           "ETH",
  solana:             "SOL",
  binancecoin:        "BSC",
  "matic-network":    "POL",
  "avalanche-2":      "AVAX",
  arbitrum:           "ARB",
  sui:                "SUI",
  aptos:              "APT",
  "the-open-network": "TON",
};

// ---------------------------------------------------------------------------
// Warm cache: top tokens by volume — refreshes every 1 hour
// ---------------------------------------------------------------------------
let warmCache: IndexToken[] | null = null;
let warmCacheTs = 0;
const WARM_TTL = 3_600_000;

// ---------------------------------------------------------------------------
// Hot cache: newly listed tokens — refreshes every 5 minutes
// Catches memecoins that haven't accumulated 24h volume yet
// ---------------------------------------------------------------------------
let hotCache: IndexToken[] | null = null;
let hotCacheTs = 0;
const HOT_TTL = 5 * 60 * 1000;

// Tokens that are native to a specific chain and should not be treated as
// canonical entries when they appear on a different chain. A "SOL" token on
// Base is a bridged wrapper, not native Solana — it must not displace native SOL.
const NATIVE_CHAIN: Record<string, string> = {
  SOL:  "SOL",
  ETH:  "ETH",
  BTC:  "BTC",
  BNB:  "BSC",
  AVAX: "AVAX",
  TON:  "TON",
  APT:  "APT",
  SUI:  "SUI",
};

// ---------------------------------------------------------------------------
// Birdeye: top tokens for a specific chain (warm cache)
// ---------------------------------------------------------------------------
async function fetchBirdeyeChain(
  apiKey: string,
  chain: string,
  chainCode: string,
  limit = 100
): Promise<IndexToken[]> {
  const res = await fetch(
    `https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=${limit}&min_liquidity=50000`,
    { headers: { "X-API-KEY": apiKey, "x-chain": chain } }
  );
  if (!res.ok) throw new Error(`Birdeye ${chain} ${res.status}`);
  const data = await res.json();
  const tokens: Array<{ symbol: string; name: string; address: string }> =
    data?.data?.tokens ?? [];
  return tokens
    .filter((t) => {
      if (!t.symbol || !t.name) return false;
      const ticker = t.symbol.toUpperCase().replace(/^\$+/, "");
      // Skip bridged/wrapped versions of native L1 tokens.
      // e.g. "SOL" on Base or "ETH" on Solana are not the canonical asset.
      const nativeChain = NATIVE_CHAIN[ticker];
      if (nativeChain && nativeChain !== chainCode) return false;
      return true;
    })
    .map((t) => ({
      ticker:   t.symbol.toUpperCase().replace(/^\$+/, ""),
      name:     t.name,
      type:     "crypto" as const,
      chain:    chainCode,
      address:  t.address ?? null,
      exchange: null,
    }));
}

// ---------------------------------------------------------------------------
// Birdeye: recently listed tokens across all chains (hot cache)
// Uses Birdeye's own vetting — verify_token is implicit for listed tokens.
// meme_platform_enabled=true includes pump.fun and similar launchpads.
// ---------------------------------------------------------------------------
async function fetchBirdeyeNewListings(apiKey: string): Promise<IndexToken[]> {
  const res = await fetch(
    "https://public-api.birdeye.so/defi/token_new_listing?limit=20&meme_platform_enabled=true",
    { headers: { "X-API-KEY": apiKey } }
  );
  if (!res.ok) throw new Error(`Birdeye new_listing ${res.status}`);
  const data = await res.json();
  const items: Array<{ symbol?: string; name?: string; address?: string; networkId?: string }> =
    data?.data?.items ?? [];
  return items
    .filter((t) => t.symbol && t.name && t.address)
    .map((t) => {
      const rawChain = (t.networkId ?? "solana").toLowerCase();
      const chain = BIRDEYE_CHAIN_MAP[rawChain] ?? rawChain.toUpperCase();
      return {
        ticker:   t.symbol!.toUpperCase().replace(/^\$+/, ""),
        name:     t.name!,
        type:     "crypto" as const,
        chain,
        address:  t.address!,
        exchange: null,
      };
    });
}

// ---------------------------------------------------------------------------
// CoinGecko: top 500 by market cap — broad coverage, no addresses
// ---------------------------------------------------------------------------
async function fetchCoinGecko(): Promise<IndexToken[]> {
  const pages = await Promise.all(
    [1, 2].map((page) =>
      fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`
      ).then((r) => (r.ok ? r.json() : []))
    )
  );
  const coins: Array<{ id: string; symbol: string; name: string; market_cap?: number | null }> = pages.flat();
  return coins
    .filter((c) => c.symbol && c.name)
    .map((c) => ({
      ticker:    c.symbol.toUpperCase().replace(/^\$+/, ""),
      name:      c.name,
      type:      "crypto" as const,
      chain:     COINGECKO_CHAIN[c.id] ?? null,
      address:   null,
      exchange:  null,
      marketCap: c.market_cap ?? null,
    }));
}

// ---------------------------------------------------------------------------
// Deduplicate tokens — first occurrence wins (caller controls priority)
// ---------------------------------------------------------------------------
function dedup(tokens: IndexToken[]): IndexToken[] {
  const seen = new Set<string>();
  const out: IndexToken[] = [];
  for (const t of tokens) {
    if (!seen.has(t.ticker)) {
      seen.add(t.ticker);
      out.push(t);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET() {
  const now = Date.now();

  // Refresh hot cache (new listings) if stale
  if (!hotCache || now - hotCacheTs > HOT_TTL) {
    const birdeyeKey = process.env.BIRDEYE_API_KEY;
    if (birdeyeKey) {
      const result = await Promise.allSettled([fetchBirdeyeNewListings(birdeyeKey)]);
      if (result[0].status === "fulfilled") {
        hotCache = result[0].value;
        hotCacheTs = now;
      }
    }
    hotCache = hotCache ?? [];
    hotCacheTs = hotCacheTs || now;
  }

  // Refresh warm cache (top tokens) if stale
  if (!warmCache || now - warmCacheTs > WARM_TTL) {
    const birdeyeKey = process.env.BIRDEYE_API_KEY;

    const [solResult, ethResult, baseResult, geckoResult] = await Promise.allSettled([
      birdeyeKey ? fetchBirdeyeChain(birdeyeKey, "solana", "SOL", 100) : Promise.resolve([]),
      birdeyeKey ? fetchBirdeyeChain(birdeyeKey, "ethereum", "ETH", 50) : Promise.resolve([]),
      birdeyeKey ? fetchBirdeyeChain(birdeyeKey, "base", "BASE", 30) : Promise.resolve([]),
      fetchCoinGecko(),
    ]);

    const sol   = solResult.status   === "fulfilled" ? solResult.value   : [];
    const eth   = ethResult.status   === "fulfilled" ? ethResult.value   : [];
    const base  = baseResult.status  === "fulfilled" ? baseResult.value  : [];
    const gecko = geckoResult.status === "fulfilled" ? geckoResult.value : [];

    // Priority: Birdeye (has addresses) > CoinGecko (market cap coverage only)
    warmCache = dedup([...sol, ...eth, ...base, ...gecko]);
    warmCacheTs = now;
  }

  // Merge: warm (established top tokens) > hot (new listings) > static stocks
  // Warm cache wins for any ticker already known — prevents a scam/bridged "SOL"
  // on Base from displacing native SOL just because it was listed today.
  // New listings only fill in tickers not already present in the warm cache.
  const combined = dedup([...(warmCache ?? []), ...(hotCache ?? []), ...STOCK_INDEX]);

  return NextResponse.json(combined);
}
