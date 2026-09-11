import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { disconnectPinterestConnection } from "../../../../../lib/pinterest-integration";

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));
  await disconnectPinterestConnection().catch((error) => console.error("Pinterest disconnect failed", error));
  return NextResponse.redirect(new URL("/social?pinterest=disconnected", request.url));
}
