import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { disconnectPinterestConnection } from "../../../../../lib/pinterest-integration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  await disconnectPinterestConnection().catch((error) => console.error("Pinterest disconnect failed", error));
  return NextResponse.redirect(new URL("/social?pinterest=disconnected", request.url));
}
