import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { disconnectMetaConnection } from "../../../../../lib/meta-integration";

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));
  await disconnectMetaConnection();
  return NextResponse.redirect(new URL("/social?meta=disconnected", request.url));
}
