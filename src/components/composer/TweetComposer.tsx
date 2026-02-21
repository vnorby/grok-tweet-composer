"use client";

import { useState, useRef, useCallback, useMemo, useEffect, KeyboardEvent } from "react";
import type { XUserProfile, CashtagSuggestion, SuggestRequest, UserInsight } from "@/types";
import { useCashtagDetection } from "@/hooks/useCashtagDetection";
import { useGrokSuggest, seedSuggestCache } from "@/hooks/useGrokSuggest";
import { useTokenIndex, recordSelection } from "@/hooks/useTokenIndex";
import { TweetTextarea } from "./TweetTextarea";
import { CashtagDropdown } from "./CashtagDropdown";
import { CharCounter } from "./CharCounter";

interface Props {
  activeUser: XUserProfile | null;
  insight?: UserInsight | null;
}

export function TweetComposer({ activeUser, insight }: Props) {
  const [text, setText] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isTriggerActive, cashtag, dollarSignPos } = useCashtagDetection(
    text,
    cursorPos
  );

  const userType = insight?.userType;

  const suggestReq = useMemo(
    () =>
      isTriggerActive
        ? {
            tweetText: text,
            cashtag,
            userType,
            user: activeUser
              ? { bio: activeUser.bio, recentTweets: activeUser.recentTweets }
              : null,
          }
        : null,
    [isTriggerActive, text, cashtag, userType, activeUser]
  );

  const tokenIndex = useTokenIndex();

  const { suggestions, loading, liveLoading, error } = useGrokSuggest(
    suggestReq,
    isTriggerActive,
    tokenIndex,
    insight?.preferredChain
  );

  // Pre-warm: fire a fast suggestion request the moment a profile loads.
  // Populates the cache for cashtag="" so the first $ press shows instant results.
  useEffect(() => {
    if (!activeUser) return;
    const prewarmReq: SuggestRequest = {
      tweetText: "",
      cashtag: "",
      userType,
      user: { bio: activeUser.bio, recentTweets: activeUser.recentTweets },
    };
    fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...prewarmReq, live: false }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.suggestions?.length > 0) seedSuggestCache(prewarmReq, data.suggestions);
      })
      .catch(() => {});
  }, [activeUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const insertCashtag = useCallback(
    (s: CashtagSuggestion) => {
      if (dollarSignPos < 0) return;
      recordSelection(s.ticker);
      const before = text.slice(0, dollarSignPos);
      const after = text.slice(cursorPos);
      const inserted = `$${s.ticker} `;
      const newText = before + inserted + after;
      setText(newText);
      setActiveIndex(0);

      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const newCursor = dollarSignPos + inserted.length;
        el.setSelectionRange(newCursor, newCursor);
        setCursorPos(newCursor);
      });
    },
    [text, cursorPos, dollarSignPos]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isTriggerActive) return;
      const total = suggestions.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(total, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + Math.max(total, 1)) % Math.max(total, 1));
      } else if ((e.key === "Enter" || e.key === "Tab") && total > 0) {
        e.preventDefault();
        insertCashtag(suggestions[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Blur the textarea briefly to collapse the dropdown
        textareaRef.current?.blur();
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [isTriggerActive, suggestions, activeIndex, insertCashtag]
  );

  const handleChange = useCallback((newText: string, pos: number) => {
    setText(newText);
    setCursorPos(pos);
    setActiveIndex(0);
  }, []);

  const showDropdown =
    isTriggerActive && (loading || liveLoading || suggestions.length > 0 || !!error);

  const anchorRef = textareaRef as React.RefObject<HTMLElement | null>;

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {/* User avatar row */}
      {activeUser && (
        <div className="flex items-center gap-2 pb-1">
          <div
            className="h-8 w-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
            style={{ background: "var(--bg-hover)", color: "var(--accent)" }}
          >
            {activeUser.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeUser.avatarUrl}
                alt={activeUser.name}
                className="h-full w-full object-cover"
              />
            ) : (
              activeUser.name[0]?.toUpperCase()
            )}
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            @{activeUser.username}
          </span>
        </div>
      )}

      {/* Textarea + dropdown */}
      <div className="relative">
        <TweetTextarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        {showDropdown && (
          <CashtagDropdown
            suggestions={suggestions}
            loading={loading}
            liveLoading={liveLoading}
            error={error}
            activeIndex={activeIndex}
            onSelect={insertCashtag}
            anchorRef={anchorRef}
          />
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Type{" "}
          <code className="font-mono" style={{ color: "var(--accent)" }}>
            $
          </code>{" "}
          for cashtag suggestions
        </span>
        <div className="flex items-center gap-3">
          <CharCounter count={text.length} />
          <button
            className="rounded-full px-5 py-1.5 text-sm font-bold transition-opacity disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#000000" }}
            disabled={text.trim().length === 0 || text.length > 280}
            onClick={() => {
              alert(`Tweet posted:\n\n${text}`);
              setText("");
              setCursorPos(0);
            }}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
