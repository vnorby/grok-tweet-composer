"use client";

import { useState, useCallback } from "react";
import type { XUserProfile } from "@/types";

interface State {
  profile: XUserProfile | null;
  loading: boolean;
  error: string | null;
}

export function useXUser() {
  const [state, setState] = useState<State>({
    profile: null,
    loading: false,
    error: null,
  });

  const fetchUser = useCallback(async (handle: string) => {
    if (!handle.trim()) return;

    setState({ profile: null, loading: true, error: null });

    try {
      const res = await fetch(
        `/api/user?handle=${encodeURIComponent(handle.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setState({ profile: null, loading: false, error: data.error ?? "Unknown error" });
        return;
      }

      setState({ profile: data as XUserProfile, loading: false, error: null });
    } catch {
      setState({ profile: null, loading: false, error: "Network error" });
    }
  }, []);

  return { ...state, fetchUser };
}
