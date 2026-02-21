import type { SuggestRequest } from "@/types";

const SYSTEM_PROMPT = `You are a financial cashtag autocomplete engine for X (Twitter).
You have live X search — use it to find cashtags actually being discussed right now.
Return ONLY a valid JSON array — no markdown, no explanation.
Each item: {"ticker":"BTC","name":"Bitcoin","type":"crypto","chain":"ETH|SOL|BASE|BSC|ARB|AVAX|POL|TON|SUI|APT|null","reason":"5-10 word reason","address":"contract or token address if known, else null","exchange":"NASDAQ|NYSE|etc if stock, else null","confidence":0.95}

RULES:
1. SHORT PREFIX (< 5 chars): search X for active cashtags whose ticker starts with the prefix.
   E.g. "AUT" → search X → find $AUTOMATON (Solana memecoin), $AUTO, etc.
2. LONG INPUT (≥ 5 chars): treat as a name/keyword search. Find the ticker for that token or company.
   E.g. "automaton" → find the $AUTOMATON ticker.
3. Empty prefix: suggest cashtags relevant to the tweet text and user context.
4. Always return the FULL ticker symbol — never the bare input text itself.
5. Max 5 results. "type" = "stock" or "crypto". "chain" = "ETH", "SOL", or null.
   IMPORTANT: Only return fungible tokens and stocks. Never return NFT collections, NFT projects, or non-fungible tokens of any kind.
6. Prefer what is actually trending on X now over training data alone.
7. RANKING: use the tweet text and user context to rank among equally valid matches.
   E.g. prefix "A", tweet mentions "hardware company" → rank $AAPL above $AMC or $AMZN.
   E.g. prefix "A", tweet mentions "Solana memecoins" → rank $AUTISM or $ANSEM above $AAPL.
8. If nothing matches, return [].
9. "confidence": 0.0-1.0. Use 0.9+ for well-known tickers you are certain exist and are actively traded. Use 0.5-0.7 for plausible but unverified tokens. Use low confidence when the token is obscure or you are guessing.`;

export function buildGrokPrompt(req: SuggestRequest): {
  system: string;
  user: string;
} {
  // Tweet count scales down based on classification — we already know what kind of user this is
  const tweetCount = req.userType === "stock" ? 0 : req.userType === "crypto" ? 5 : 10;
  const userTweets = (req.user?.recentTweets ?? [])
    .slice(0, tweetCount)
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  let userSection: string;
  if (!req.user) {
    userSection = `User context: none — base suggestions on tweet text and live X search only.`;
  } else if (req.userType === "stock") {
    userSection = `User profile: equity/stock trader. Strongly prefer stocks and ETFs. Only suggest a crypto token if the prefix unambiguously matches no known stock.
User bio: "${req.user.bio}"`;
  } else if (req.userType === "crypto") {
    userSection = `User profile: crypto-focused. Prefer tokens when the prefix is ambiguous. However, always rank a well-known stock or index first if the prefix is an exact or near-exact match (e.g. $SPX = S&P 500, $AAPL = Apple).
User bio: "${req.user.bio}"
Sample tweets:
${userTweets}`;
  } else {
    userSection = `User bio: "${req.user.bio}"
User's recent tweets:
${userTweets}`;
  }

  const tweetContext = req.tweetText.trim()
    ? `Tweet being composed: "${req.tweetText}" ← use this to rank suggestions`
    : `Tweet being composed: (empty)`;

  // When local index candidates are provided, Grok ranks rather than discovers.
  // Prompt is ~100 tokens vs ~800 tokens — significantly faster.
  const taskLine = req.candidates?.length
    ? `Local index candidates for "${req.cashtag}": ${req.candidates
        .map((c) => `${c.ticker} (${c.name}${c.chain ? `, ${c.chain}` : c.exchange ? `, ${c.exchange}` : ""})`)
        .join(", ")}

Rank the candidates above by relevance to the tweet and user context. You may add 1-2 highly relevant suggestions not listed. Return up to 5 as a JSON array.`
    : `Search X for cashtags matching "${req.cashtag}". Rank results by relevance to the tweet text. Return up to 5 as a JSON array.`;

  const userMessage = `Cashtag input: "${req.cashtag}"
${tweetContext}
${userSection}

${taskLine}`;

  return { system: SYSTEM_PROMPT, user: userMessage };
}
