"use client";

import { useMemo } from "react";
import type { CashtagDetectionResult } from "@/types";

export function useCashtagDetection(
  text: string,
  cursorPos: number
): CashtagDetectionResult {
  return useMemo(() => {
    const notFound: CashtagDetectionResult = {
      isTriggerActive: false,
      cashtag: "",
      dollarSignPos: -1,
    };

    if (cursorPos <= 0) return notFound;

    // Scan backward from cursor
    let i = cursorPos - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "$") {
        // Check that character before $ is whitespace or start of string
        if (i === 0 || /\s/.test(text[i - 1])) {
          return {
            isTriggerActive: true,
            cashtag: text.slice(i + 1, cursorPos),
            dollarSignPos: i,
          };
        }
        return notFound;
      }
      // Hit whitespace before finding $ — no trigger
      if (/\s/.test(ch)) return notFound;
      i--;
    }

    return notFound;
  }, [text, cursorPos]);
}
