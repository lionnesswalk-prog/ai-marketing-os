import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { disconnectTikTokConnection } from "../../../../../lib/tiktok-integration";

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));
  await disconnectTikTokConnection().catch((error) => console.error("TikTok disconnect failed", error));
  return NextResponse.redirect(new URL("/social?tiktok=disconnected", request.url));
}
