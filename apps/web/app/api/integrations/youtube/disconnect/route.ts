import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { disconnectYouTubeConnection } from "../../../../../lib/youtube-integration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  await disconnectYouTubeConnection().catch((error) => console.error("YouTube disconnect failed", error));
  return NextResponse.redirect(new URL("/social?youtube=disconnected", request.url));
}
