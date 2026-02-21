"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { XUserProfile } from "@/types";
import { analyzeUser } from "@/lib/classifyUser";
import { useXUser } from "@/hooks/useXUser";
import { UserSelector } from "@/components/profile/UserSelector";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ProfileSwitcher } from "@/components/profile/ProfileSwitcher";
import { TweetComposer } from "@/components/composer/TweetComposer";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { HowItWorks } from "@/components/ui/HowItWorks";

export default function Home() {
  const { profile, loading, error, fetchUser } = useXUser();
  const [savedUsers, setSavedUsers] = useState<XUserProfile[]>([]);
  const [activeUser, setActiveUser] = useState<XUserProfile | null>(null);

  // When a new profile loads, save it and make it active
  useEffect(() => {
    if (!profile) return;
    setActiveUser(profile);
    setSavedUsers((prev) => {
      const exists = prev.some((u) => u.username === profile.username);
      return exists
        ? prev.map((u) => (u.username === profile.username ? profile : u))
        : [...prev, profile];
    });
  }, [profile]);

  const handleLoad = useCallback(
    (handle: string) => {
      fetchUser(handle);
    },
    [fetchUser]
  );

  const handleSelect = useCallback((p: XUserProfile) => {
    setActiveUser(p);
  }, []);

  const insight = useMemo(
    () => activeUser ? analyzeUser(activeUser.bio, activeUser.recentTweets) : null,
    [activeUser]
  );

  const handleRemove = useCallback((username: string) => {
    setSavedUsers((prev) => prev.filter((u) => u.username !== username));
    setActiveUser((prev) =>
      prev?.username === username ? null : prev
    );
  }, []);

  return (
    <main className="min-h-screen py-12 px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Grok Cashtag Composer
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Type{" "}
            <code className="font-mono" style={{ color: "var(--accent)" }}>$</code>
            {" "}in the composer for AI-powered cashtag suggestions based on the user&apos;s profile.
          </p>
        </div>

        {/* User loader */}
        <div className="space-y-3">
          <UserSelector onLoad={handleLoad} loading={loading} />
          {error && <ErrorBanner message={error} />}
          <ProfileSwitcher
            users={savedUsers}
            activeUsername={activeUser?.username ?? null}
            onSelect={handleSelect}
            onRemove={handleRemove}
          />
        </div>

        {/* Active profile card */}
        {activeUser && <ProfileCard profile={activeUser} insight={insight} />}

        {/* Tweet composer */}
        <TweetComposer activeUser={activeUser} insight={insight} />

        {/* How it works */}
        <HowItWorks />

        {/* Footer */}
        <p className="text-center text-xs pb-4" style={{ color: "var(--text-secondary)" }}>
          Powered by{" "}
          <span style={{ color: "var(--accent)" }}>Grok</span>
          {" · "}
          <span>X API v2</span>
        </p>
      </div>
    </main>
  );
}
