import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { disconnectLinkedInConnection } from "../../../../../lib/linkedin-integration";

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));
  await disconnectLinkedInConnection().catch((error) => console.error("LinkedIn disconnect failed", error));
  return NextResponse.redirect(new URL("/social?linkedin=disconnected", request.url));
}
