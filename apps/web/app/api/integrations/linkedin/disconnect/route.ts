import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { disconnectLinkedInConnection } from "../../../../../lib/linkedin-integration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  await disconnectLinkedInConnection().catch((error) => console.error("LinkedIn disconnect failed", error));
  return NextResponse.redirect(new URL("/social?linkedin=disconnected", request.url));
}
