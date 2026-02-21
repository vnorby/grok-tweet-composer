import Image from "next/image";
import type { XUserProfile, UserInsight } from "@/types";

interface Props {
  profile: XUserProfile;
  insight?: UserInsight | null;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const TYPE_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  crypto: { bg: "rgba(159,110,245,0.15)", text: "#9f6ef5", border: "rgba(159,110,245,0.3)", label: "Crypto" },
  stock:  { bg: "rgba(29,155,240,0.15)",  text: "#1d9bf0", border: "rgba(29,155,240,0.3)",  label: "Stocks" },
  mixed:  { bg: "rgba(113,118,123,0.15)", text: "#71767b", border: "rgba(113,118,123,0.3)", label: "Mixed" },
};

const CHAIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ETH:  { bg: "rgba(98,126,234,0.15)",  text: "#627eea", border: "rgba(98,126,234,0.3)"  },
  SOL:  { bg: "rgba(153,69,255,0.15)",  text: "#9945ff", border: "rgba(153,69,255,0.3)"  },
  BASE: { bg: "rgba(0,82,255,0.15)",    text: "#0052ff", border: "rgba(0,82,255,0.3)"    },
  BSC:  { bg: "rgba(243,186,47,0.15)",  text: "#f3ba2f", border: "rgba(243,186,47,0.3)"  },
  ARB:  { bg: "rgba(40,160,240,0.15)",  text: "#28a0f0", border: "rgba(40,160,240,0.3)"  },
  AVAX: { bg: "rgba(232,65,66,0.15)",   text: "#e84142", border: "rgba(232,65,66,0.3)"   },
  POL:  { bg: "rgba(130,71,229,0.15)",  text: "#8247e5", border: "rgba(130,71,229,0.3)"  },
  TON:  { bg: "rgba(0,136,204,0.15)",   text: "#0088cc", border: "rgba(0,136,204,0.3)"   },
  SUI:  { bg: "rgba(78,166,250,0.15)",  text: "#4ea6fa", border: "rgba(78,166,250,0.3)"  },
  APT:  { bg: "rgba(0,191,165,0.15)",   text: "#00bfa5", border: "rgba(0,191,165,0.3)"   },
};

function Pill({ label, style }: { label: string; style: { bg: string; text: string; border: string } }) {
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold font-mono uppercase tracking-wide"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {label}
    </span>
  );
}

export function ProfileCard({ profile, insight }: Props) {
  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-lg font-bold"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            >
              {profile.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold" style={{ color: "var(--text-primary)" }}>
            {profile.name}
          </p>
          <p className="truncate text-sm" style={{ color: "var(--text-secondary)" }}>
            @{profile.username}
          </p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Followers</p>
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {formatCount(profile.followerCount)}
          </p>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {profile.bio}
        </p>
      )}

      {/* Context insight */}
      {insight && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            Detected context
          </p>
          <div className="rounded-xl px-3 py-2.5 space-y-2.5" style={{ background: "var(--bg-hover)" }}>
            {/* Type + chain badges */}
            <div className="flex flex-wrap gap-1.5">
              <Pill label={TYPE_STYLE[insight.userType].label} style={TYPE_STYLE[insight.userType]} />
              {insight.preferredChain && CHAIN_COLORS[insight.preferredChain] && (
                <Pill label={insight.preferredChain} style={CHAIN_COLORS[insight.preferredChain]} />
              )}
            </div>

            {/* Frequently mentioned tickers */}
            {insight.frequentTickers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {insight.frequentTickers.map((ticker) => (
                  <span
                    key={ticker}
                    className="text-[11px] font-bold font-mono"
                    style={{ color: "var(--accent)" }}
                  >
                    ${ticker}
                  </span>
                ))}
              </div>
            )}

            {/* Empty state for tickers */}
            {insight.frequentTickers.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                No cashtags in recent tweets
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
