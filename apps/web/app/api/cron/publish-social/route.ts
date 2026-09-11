import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const userAgent = request.headers.get("user-agent") || "";

  if (secret) {
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!userAgent.includes("vercel-cron/1.0")) {
    return NextResponse.json({ error: "Cron invocation required." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, scheduler: "ready" });
}
