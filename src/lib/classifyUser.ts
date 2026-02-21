import type { UserInsight } from "@/types";

export type UserType = "crypto" | "stock" | "mixed";

// Strong signals for each camp
const CRYPTO_TERMS = [
  // culture
  "gm", "wagmi", "ngmi", "degen", "ape", "rekt", "hodl", "moon", "fud",
  "fomo", "alpha", "shill", "ser", "anon", "based", "rug", "pump", "dump",
  // tech
  "defi", "dex", "cefi", "dao", "web3", "blockchain", "wallet", "memecoin",
  "airdrop", "mint", "stake", "swap", "bridge", "yield", "apy", "tvl",
  "liquidity", "smart contract", "on-chain", "onchain", "testnet", "mainnet",
  // chains / ecosystems
  "solana", "ethereum", "bitcoin", "polygon", "avalanche", "arbitrum",
  "optimism", "base chain", "sui network", "aptos", "cosmos", "near",
  "ton coin", "bnb chain", "binance smart chain",
  // tickers as words (common in bios)
  "btc", "eth", "sol", "matic", "avax", "arb",
];

const STOCK_TERMS = [
  // analysis
  "earnings", "eps", "revenue", "margin", "guidance", "analyst", "upgrade",
  "downgrade", "target price", "price target", "forward pe", "p/e",
  "ebitda", "free cash flow", "buyback", "dividend", "split",
  // venues / products
  "nasdaq", "nyse", "amex", "ipo", "spac", "float", "short interest",
  "short squeeze", "options", "calls", "puts", "leaps", "covered call",
  "iron condor", "theta", "delta", "gamma", "iv rank",
  // macro
  "fomc", "federal reserve", "cpi", "ppi", "inflation", "rate hike",
  "yield curve", "equities", "equity", "shares outstanding",
  // well-known tickers used as words in stock-world context
  "spy", "qqq", "vix", "iwm",
];

// Chain-specific signals for detecting a user's preferred network
const CHAIN_SIGNALS: Record<string, string[]> = {
  SOL:  ["solana", "phantom", "raydium", "jupiter", " jup ", "marinade", "spl token", "$sol"],
  ETH:  ["ethereum", " evm ", "metamask", "layer 2", " l2 ", "gwei", "ens domain", "$eth"],
  BASE: ["base chain", "base network", "onbase", "base ecosystem", "coinbase wallet", "$degen", "$brett"],
  ARB:  ["arbitrum", "arb ecosystem", "$arb"],
  BSC:  ["binance smart chain", "bnb chain", "bsc ", "pancakeswap", "$bnb"],
  AVAX: ["avalanche", "avax ecosystem", "$avax"],
  POL:  ["polygon", "matic network", "$matic", "$pol"],
  TON:  ["ton network", "ton blockchain", "toncoin", "$ton"],
  SUI:  ["sui network", "sui blockchain", " $sui "],
  APT:  ["aptos network", "aptos blockchain", "$apt"],
};

function countMatches(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0);
}

function detectPreferredChain(corpus: string): string | null {
  const lower = corpus.toLowerCase();
  const scores: [string, number][] = Object.entries(CHAIN_SIGNALS).map(
    ([chain, terms]) => [chain, terms.reduce((n, t) => n + (lower.split(t).length - 1), 0)]
  );
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : null;
}

function extractFrequentTickers(tweets: string[]): string[] {
  const counts = new Map<string, number>();
  for (const tweet of tweets) {
    for (const match of tweet.matchAll(/\$([A-Za-z]{1,10})\b/g)) {
      const ticker = match[1].toUpperCase();
      counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([ticker]) => ticker);
}

/**
 * Classify an X user as crypto-focused, stock-focused, or mixed.
 * Runs entirely in JS — zero latency, called once per profile load.
 */
export function classifyUser(bio: string, recentTweets: string[]): UserType {
  const bioWeight = 2;
  const tweetSample = recentTweets.slice(0, 30).join(" ");
  const corpus = bio.repeat(bioWeight) + " " + tweetSample;

  const cryptoScore = countMatches(corpus, CRYPTO_TERMS);
  const stockScore = countMatches(corpus, STOCK_TERMS);

  if (cryptoScore === 0 && stockScore === 0) return "mixed";
  if (cryptoScore === 0) return "stock";
  if (stockScore === 0) return "crypto";

  const ratio = cryptoScore / (cryptoScore + stockScore);
  if (ratio >= 0.65) return "crypto";
  if (ratio <= 0.35) return "stock";
  return "mixed";
}

/**
 * Full profile analysis — type, preferred chain, and frequently mentioned tickers.
 * Runs in JS, zero latency, called once per profile load.
 */
export function analyzeUser(bio: string, recentTweets: string[]): UserInsight {
  const userType = classifyUser(bio, recentTweets);
  const corpus = bio + " " + recentTweets.slice(0, 30).join(" ");
  const preferredChain = userType !== "stock" ? detectPreferredChain(corpus) : null;
  const frequentTickers = extractFrequentTickers(recentTweets);
  return { userType, preferredChain, frequentTickers };
}
