import { NextRequest, NextResponse } from "next/server";
import type { XUserProfile } from "@/types";
import { checkRateLimit } from "@/lib/rateLimit";

const VALID_HANDLE = /^[A-Za-z0-9_]{1,50}$/;

export async function GET(req: NextRequest) {
  // 15 requests per minute per IP — X API has strict per-app quotas
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`user:${ip}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const handle = req.nextUrl.searchParams.get("handle")?.trim();

  if (!handle || !VALID_HANDLE.test(handle)) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer) {
    return NextResponse.json(
      { error: "X_BEARER_TOKEN not configured" },
      { status: 503 }
    );
  }

  const headers = { Authorization: `Bearer ${bearer}` };

  // 1. Fetch user by username
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=description,profile_image_url,public_metrics,name`,
    { headers, next: { revalidate: 0 } }
  );

  if (userRes.status === 429) {
    return NextResponse.json({ error: "Rate limited by X API" }, { status: 429 });
  }
  if (!userRes.ok) {
    const status = userRes.status === 404 ? 404 : 503;
    return NextResponse.json(
      { error: status === 404 ? "User not found" : "X API error" },
      { status }
    );
  }

  const userData = await userRes.json();
  const xUser = userData?.data;
  if (!xUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 2. Fetch recent tweets
  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${xUser.id}/tweets?max_results=100&tweet.fields=text`,
    { headers, next: { revalidate: 0 } }
  );

  let recentTweets: string[] = [];
  if (tweetsRes.ok) {
    const tweetsData = await tweetsRes.json();
    recentTweets = (tweetsData?.data ?? []).map(
      (t: { text: string }) => t.text
    );
  }

  // Replace _normal with _400x400 for larger avatar
  const rawAvatar: string = xUser.profile_image_url ?? "";
  const avatarUrl = rawAvatar.replace("_normal", "_400x400");

  const profile: XUserProfile = {
    id: xUser.id,
    username: xUser.username,
    name: xUser.name ?? xUser.username,
    bio: xUser.description ?? "",
    avatarUrl,
    followerCount: xUser.public_metrics?.followers_count ?? 0,
    recentTweets,
  };

  return NextResponse.json(profile);
}
