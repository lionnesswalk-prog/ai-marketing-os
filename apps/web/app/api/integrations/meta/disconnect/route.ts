import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { disconnectMetaConnection } from "../../../../../lib/meta-integration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  await disconnectMetaConnection();
  return NextResponse.redirect(new URL("/social?meta=disconnected", request.url));
}
