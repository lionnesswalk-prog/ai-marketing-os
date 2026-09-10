import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { getAuthMode } from "../../../../lib/auth-service";

export async function GET() {
  return NextResponse.json({ user: await getSession(), mode: getAuthMode() });
}
