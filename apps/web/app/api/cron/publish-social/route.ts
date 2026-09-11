import { NextResponse } from "next/server";
import { runScheduledPublisher } from "../../../../lib/scheduled-publisher";

export const dynamic = "force-dynamic";
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

  try {
    const result = await runScheduledPublisher(3);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("scheduled social publisher failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Scheduled publisher failed.",
    }, { status: 500 });
  }
}
