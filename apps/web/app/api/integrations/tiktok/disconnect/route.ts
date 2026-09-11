import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { disconnectTikTokConnection } from "../../../../../lib/tiktok-integration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  await disconnectTikTokConnection().catch((error) => console.error("TikTok disconnect failed", error));
  return NextResponse.redirect(new URL("/social?tiktok=disconnected", request.url));
}
