import type { CashtagSuggestion } from "@/types";

interface Props {
  suggestion: CashtagSuggestion;
}

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

const FALLBACK_CRYPTO = { bg: "rgba(159,110,245,0.15)", text: "#9f6ef5", border: "rgba(159,110,245,0.3)" };
const STOCK_COLORS    = { bg: "rgba(29,155,240,0.15)",  text: "#1d9bf0", border: "rgba(29,155,240,0.3)"  };

export function Badge({ suggestion }: Props) {
  const { type, chain } = suggestion;

  const label = type === "stock" ? "STOCK" : (chain ?? "CRYPTO");
  const colors = type === "stock"
    ? STOCK_COLORS
    : (chain ? (CHAIN_COLORS[chain] ?? FALLBACK_CRYPTO) : FALLBACK_CRYPTO);

  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide shrink-0"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  );
}
