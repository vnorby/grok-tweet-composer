# Grok Cashtag Composer

A demo tweet composer that suggests cashtag completions in real time using **Grok AI** and **Birdeye** verified on-chain data. Load any X (Twitter) handle and the suggestions adapt to that user's financial interests — a crypto trader sees crypto tokens first, an equity investor sees stocks.

**Live demo:** https://grok-tweet-composer.vercel.app

---

## What it does

Type `$` anywhere in the composer. The engine immediately shows candidates from a locally cached token index, then enriches them asynchronously with Grok's context-aware suggestions and Birdeye's verified on-chain addresses — all within a few hundred milliseconds.

The demo is designed to show how X could deterministically identify *which* token a tweet is about, making it possible to group tweets about `$USDC on Solana` separately from `$USDC on Ethereum` using the token address as the canonical identifier.

---

## How suggestions are ranked

Results are sorted by four signals applied in priority order:

| Priority | Signal | Notes |
|---|---|---|
| 1 | **Selection history** | Tickers you've picked before, stored in `localStorage` |
| 2 | **Tier-1 prominence** | BTC, ETH, AAPL, NVDA, etc. always beat obscure tokens |
| 3 | **Preferred chain** | Inferred from the loaded user profile; active at prefix ≥ 3 chars |
| 4 | **Domain type** | Crypto-native users see crypto first; stock traders see equities first |

Chain bias and domain type are suppressed at short prefixes (< 3 chars) to avoid over-filtering ambiguous queries like `$AA`.

---

## Architecture

```
User types $BTC
     │
     ├─► Local token index (in-memory)           ~0ms   → placeholder results shown immediately
     │
     └─► POST /api/suggest
              ├─► Grok API  (tweet context + user profile)    ┐
              └─► Birdeye   (verified on-chain addresses)     ┘ parallel, ~300–800ms
                       │
                       └─► filterSuggestions → backfillFromCandidates → enrichWithBirdeye → ranked dropdown
```

### Token index (`/api/index`)

- **Warm cache** (1-hour TTL): top tokens by 24h USD volume from Birdeye across SOL, ETH, and BASE, plus top-500 market cap from CoinGecko
- **Hot cache** (5-minute TTL): newly listed tokens from Birdeye's `token_new_listing` endpoint, capturing memecoins before they accumulate volume
- Warm cache wins deduplication — prevents a newly listed scam token from displacing an established one

### Chain disambiguation

The same ticker (`USDC`, `SOL`, `ETH`) can exist on dozens of chains. The engine resolves the correct entry by:

1. Preferring the chain inferred from the user's profile (SOL-native users get Solana tokens)
2. Protecting native L1 tokens — a bridged "SOL" on Base is filtered out and never displaces native Solana SOL
3. Attaching Birdeye's verified contract address so tweets can be unambiguously grouped

---

## Stack

- **Next.js 15** App Router, TypeScript, Tailwind CSS 4
- **Grok API** (`api.x.ai`) — fast non-reasoning model for cashtag disambiguation
- **Birdeye API** — verified on-chain token data and new listing feed
- **X API v2** — user profiles and recent tweets for contextual suggestions
- No runtime dependencies beyond Next.js, React, and Tailwind

---

## Running locally

### 1. Clone and install

```bash
git clone https://github.com/vnorby/grok-tweet-composer.git
cd grok-tweet-composer
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# X API v2 OAuth 2.0 App-Only Bearer Token
# https://developer.x.com/
X_BEARER_TOKEN=

# xAI Grok API key
# https://console.x.ai/
GROK_API_KEY=

# Birdeye API key (optional — token addresses won't be enriched without it)
# https://birdeye.so/
BIRDEYE_API_KEY=
```

All three secrets are used exclusively in server-side API routes (`/api/*`). Nothing is exposed to the browser.

### 3. Start the dev server

```bash
npm run dev
# App runs at http://localhost:3001
```

### 4. Run tests

```bash
npm test          # 35 unit tests via Vitest
npm run typecheck # TypeScript strict check
```

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                   # App shell
│   └── api/
│       ├── index/route.ts         # Token index — dual warm/hot cache
│       ├── suggest/route.ts       # Cashtag suggestions — Grok + Birdeye
│       └── user/route.ts          # X user profile proxy
├── components/
│   ├── composer/
│   │   ├── TweetComposer.tsx      # State orchestrator
│   │   ├── TweetTextarea.tsx      # Controlled textarea
│   │   ├── CashtagDropdown.tsx    # Autocomplete dropdown
│   │   └── CharCounter.tsx        # 280-char SVG ring
│   ├── profile/
│   │   ├── UserSelector.tsx       # Handle input
│   │   ├── ProfileCard.tsx        # Avatar, bio, recent tweets
│   │   └── ProfileSwitcher.tsx    # Session-saved handle pills
│   └── ui/
│       ├── HowItWorks.tsx         # Collapsible engine explainer
│       ├── Badge.tsx              # STOCK / CRYPTO / chain pills
│       └── ...
├── hooks/
│   ├── useCashtagDetection.ts     # $ trigger + query extraction
│   ├── useGrokSuggest.ts          # Debounced POST /api/suggest
│   ├── useTokenIndex.ts           # Local index search + selection history
│   └── useXUser.ts                # GET /api/user fetch
└── lib/
    ├── grok.ts                    # buildGrokPrompt()
    ├── suggestUtils.ts            # filterSuggestions, backfill, enrich
    ├── rateLimit.ts               # In-memory rate limiter
    └── chains.ts                  # Birdeye chain ID map
```

---

## API security

- All API keys (`GROK_API_KEY`, `X_BEARER_TOKEN`, `BIRDEYE_API_KEY`) live only in server-side route handlers — no `NEXT_PUBLIC_` exposure
- `/api/suggest` is rate-limited to 20 requests/min/IP
- `/api/user` is rate-limited to 15 requests/min/IP
- Input validation on all routes (cashtag max 10 chars alphanumeric, tweet text max 280 chars)
