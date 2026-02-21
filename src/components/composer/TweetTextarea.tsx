"use client";

import { forwardRef, useEffect, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (text: string, cursorPos: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
}

export const TweetTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function TweetTextarea({ value, onChange, onKeyDown, disabled }, ref) {
    // Auto-resize
    useEffect(() => {
      const el =
        typeof ref === "function" ? null : ref?.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value, ref]);

    function reportCursor(e: React.SyntheticEvent<HTMLTextAreaElement>) {
      const el = e.target as HTMLTextAreaElement;
      onChange(el.value, el.selectionStart ?? 0);
    }

    return (
      <textarea
        ref={ref}
        value={value}
        onChange={reportCursor}
        onKeyUp={reportCursor}
        onClick={reportCursor}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="What is happening?!"
        maxLength={280}
        rows={3}
        className="w-full resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:opacity-40 disabled:opacity-50"
        style={{
          color: "var(--text-primary)",
          caretColor: "var(--accent)",
          fontFamily: "inherit",
          minHeight: "80px",
        }}
        aria-label="Tweet composer"
        spellCheck
      />
    );
  }
);
