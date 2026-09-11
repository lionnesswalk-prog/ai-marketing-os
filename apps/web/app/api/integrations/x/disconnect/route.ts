import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { disconnectXConnection } from "../../../../../lib/x-integration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  await disconnectXConnection().catch((error) => console.error("X disconnect failed", error));
  return NextResponse.redirect(new URL("/social?x=disconnected", request.url));
}
