import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { disconnectYouTubeConnection } from "../../../../../lib/youtube-integration";

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));
  await disconnectYouTubeConnection().catch((error) => console.error("YouTube disconnect failed", error));
  return NextResponse.redirect(new URL("/social?youtube=disconnected", request.url));
}
