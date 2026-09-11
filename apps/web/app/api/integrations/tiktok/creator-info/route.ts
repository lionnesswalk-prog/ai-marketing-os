import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { queryTikTokCreatorInfo } from "../../../../../lib/tiktok-integration";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const creator = await queryTikTokCreatorInfo();
    return NextResponse.json({ ok: true, creator });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load TikTok creator information.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
