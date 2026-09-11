import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { disconnectXConnection } from "../../../../../lib/x-integration";

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));
  await disconnectXConnection().catch((error) => console.error("X disconnect failed", error));
  return NextResponse.redirect(new URL("/social?x=disconnected", request.url));
}
