export interface XUserProfile {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  recentTweets: string[];
}

export interface CashtagSuggestion {
  ticker: string;
  name: string;
  type: "stock" | "crypto";
  chain: "ETH" | "SOL" | "BASE" | "BSC" | "ARB" | "AVAX" | "POL" | "TON" | "SUI" | "APT" | null;
  reason: string;
  /** Crypto: contract/token address. Null if unknown. */
  address?: string | null;
  /** Stock: exchange listing (e.g. "NASDAQ", "NYSE"). Null for crypto. */
  exchange?: string | null;
  /** Grok confidence score 0–1. 0.9+ = well-known; <0.8 = uncertain/obscure. */
  confidence?: number;
}

/** A token or stock entry from the local index */
export interface IndexToken {
  ticker: string;
  name: string;
  type: "crypto" | "stock";
  chain?: string | null;
  address?: string | null;
  exchange?: string | null;
}

export interface SuggestRequest {
  tweetText: string;
  cashtag: string;
  user: { bio: string; recentTweets: string[] } | null;
  /** Pre-computed user classification — drives prompt length and ranking bias */
  userType?: "crypto" | "stock" | "mixed";
  /** Local index candidates — switches Grok from discovery mode to rank mode */
  candidates?: IndexToken[];
  /** User's preferred chain (SOL, ETH, BASE…) — overrides Grok's chain bias for multi-chain tokens */
  preferredChain?: string | null;
  /** true = use Grok live X search (slow ~10s, accurate); false = training data only (fast ~2s) */
  live?: boolean;
}

export interface UserInsight {
  userType: "crypto" | "stock" | "mixed";
  /** Most-mentioned chain for crypto users, null otherwise */
  preferredChain: string | null;
  /** Top cashtags extracted from recent tweets, up to 5 */
  frequentTickers: string[];
}

export interface CashtagDetectionResult {
  isTriggerActive: boolean;
  cashtag: string;
  dollarSignPos: number;
}
