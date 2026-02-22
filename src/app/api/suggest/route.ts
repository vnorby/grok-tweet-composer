import { NextRequest, NextResponse } from "next/server";
import { buildGrokPrompt } from "@/lib/grok";
import { BIRDEYE_CHAIN_MAP } from "@/lib/chains";
import { filterSuggestions, backfillFromCandidates, enrichWithBirdeye } from "@/lib/suggestUtils";
import { checkRateLimit } from "@/lib/rateLimit";
import type { SuggestRequest, CashtagSuggestion } from "@/types";

// Node runtime required for in-memory rate limiting (module state persists across warm invocations)
export const maxDuration = 25;

const VALID_CASHTAG = /^[A-Za-z0-9]{0,10}$/;

// ---------------------------------------------------------------------------
// Birdeye token search — runs in parallel with Grok to get verified addresses
// Returns a map of SYMBOL → { address, chain } across all supported chains
// ---------------------------------------------------------------------------

// Reverse of BIRDEYE_CHAIN_MAP: our chain code → Birdeye network name
const CHAIN_TO_BIRDEYE: Record<string, string> = {
  SOL: "solana", ETH: "ethereum", ARB: "arbitrum", AVAX: "avalanche",
  BSC: "bsc", POL: "polygon", BASE: "base", SUI: "sui", TON: "ton", APT: "aptos",
};

async function searchBirdeye(
  keyword: string,
  apiKey: string,
  signal: AbortSignal,
  preferredChain?: string | null
): Promise<Map<string, { address: string; chain: string }>> {
  const url = `https://public-api.birdeye.so/defi/token_search?keyword=${encodeURIComponent(keyword)}&sort_by=v24hUSD&sort_type=desc&offset=0&limit=20&verify_token=true`;
  const birdeyeNetwork = preferredChain ? CHAIN_TO_BIRDEYE[preferredChain] : undefined;
  const res = await fetch(url, {
    // When preferredChain is set, scope the search to that chain so Birdeye
    // returns the correct variant (e.g. SOL USDC instead of ETH USDC).
    headers: { "X-API-KEY": apiKey, ...(birdeyeNetwork ? { "x-chain": birdeyeNetwork } : {}) },
    signal,
  });
  if (!res.ok) return new Map();
  const data = await res.json();
  const items: Array<{ symbol?: string; address?: string; networkId?: string }> = data?.data?.items ?? [];
  const map = new Map<string, { address: string; chain: string }>();
  for (const item of items) {
    if (!item.symbol || !item.address) continue;
    const key = item.symbol.toUpperCase();
    // Results are sorted by v24hUSD desc — keep only the highest-volume entry per symbol
    if (map.has(key)) continue;
    const rawChain = (item.networkId ?? "").toLowerCase();
    const chain = BIRDEYE_CHAIN_MAP[rawChain] ?? (rawChain.toUpperCase() || "SOL");
    map.set(key, { address: item.address, chain });
  }
  return map;
}


// ---------------------------------------------------------------------------
// Grok callers
// ---------------------------------------------------------------------------
async function callFast(
  system: string,
  userMessage: string,
  apiKey: string,
  signal: AbortSignal
): Promise<CashtagSuggestion[]> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-4-1-fast-non-reasoning",
      temperature: 0.3,
      max_tokens: 512,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Grok fast error: ${res.status}`);
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "[]";
  return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
}

async function callLive(
  system: string,
  userMessage: string,
  apiKey: string,
  signal: AbortSignal
): Promise<CashtagSuggestion[]> {
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-4-1-fast-non-reasoning",
      max_output_tokens: 512,
      tools: [{ type: "x_search" }],
      input: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Grok live error: ${res.status}`);
  const data = await res.json();
  const outputItems: Array<{ content?: Array<{ type: string; text: string }> }> = data?.output ?? [];
  const messageItem = [...outputItems].reverse().find((o) => Array.isArray(o.content));
  const raw = messageItem?.content?.find((c) => c.type === "output_text")?.text ?? "[]";
  return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // 20 requests per minute per IP — protects Grok API quota
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`suggest:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: SuggestRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tweetText, cashtag, user, userType, candidates, preferredChain, live = false } = body;

  if (typeof tweetText !== "string" || tweetText.length > 280) {
    return NextResponse.json({ error: "Invalid tweetText" }, { status: 400 });
  }
  if (typeof cashtag !== "string" || !VALID_CASHTAG.test(cashtag)) {
    return NextResponse.json({ error: "Invalid cashtag" }, { status: 400 });
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROK_API_KEY not configured" }, { status: 503 });
  }

  const birdeyeKey = process.env.BIRDEYE_API_KEY;

  const { system, user: userMessage } = buildGrokPrompt({ tweetText, cashtag, user, userType, candidates, preferredChain });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), live ? 22_000 : 8_000);

  try {
    // Run Grok and Birdeye in parallel — Birdeye adds zero sequential latency
    const [grokResult, birdeyeResult] = await Promise.allSettled([
      live
        ? callLive(system, userMessage, apiKey, controller.signal)
        : callFast(system, userMessage, apiKey, controller.signal),
      // Only search Birdeye when the prefix is long enough to be meaningful
      birdeyeKey && cashtag.length >= 2
        ? searchBirdeye(cashtag, birdeyeKey, controller.signal, preferredChain)
        : Promise.resolve(new Map<string, { address: string; chain: string }>()),
    ]);

    clearTimeout(timeout);

    if (grokResult.status === "rejected") throw grokResult.reason;

    const parsed = Array.isArray(grokResult.value) ? grokResult.value : [];
    const birdeyeMap =
      birdeyeResult.status === "fulfilled"
        ? birdeyeResult.value
        : new Map<string, { address: string; chain: string }>();

    const filtered = filterSuggestions(parsed, cashtag);
    const backfilled = backfillFromCandidates(filtered, candidates, preferredChain);
    const suggestions = enrichWithBirdeye(backfilled, birdeyeMap, preferredChain);

    return NextResponse.json({ suggestions });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: live ? "Live search timed out" : "Request timed out" }, { status: 503 });
    }
    console.error("Grok error:", err);
    return NextResponse.json({ error: "Grok request failed" }, { status: 503 });
  }
}
