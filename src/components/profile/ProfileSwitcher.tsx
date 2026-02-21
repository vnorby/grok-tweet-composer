"use client";

import type { XUserProfile } from "@/types";

interface Props {
  users: XUserProfile[];
  activeUsername: string | null;
  onSelect: (profile: XUserProfile) => void;
  onRemove: (username: string) => void;
}

export function ProfileSwitcher({ users, activeUsername, onSelect, onRemove }: Props) {
  if (users.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => {
        const isActive = user.username === activeUsername;
        return (
          <div key={user.username} className="flex items-center gap-0 rounded-full overflow-hidden" style={{
            border: `1px solid ${isActive ? "var(--border-focus)" : "var(--border)"}`,
            background: isActive ? "rgba(29,155,240,0.1)" : "var(--bg-secondary)",
          }}>
            <button
              onClick={() => onSelect(user)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
              style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }}
            >
              <span className="font-semibold">@{user.username}</span>
            </button>
            <button
              onClick={() => onRemove(user.username)}
              className="pr-2 pl-1 py-1.5 text-xs opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-secondary)" }}
              aria-label={`Remove @${user.username}`}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
