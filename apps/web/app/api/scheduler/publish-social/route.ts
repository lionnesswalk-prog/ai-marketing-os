import { NextResponse } from "next/server";
import { schedulerBatchSize } from "../../../../lib/scheduler-config";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const userAgent = request.headers.get("user-agent") || "";

  if (secret) return authorization === `Bearer ${secret}`;
  return request.method === "GET" && userAgent.includes("vercel-cron/1.0");
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized scheduler invocation." }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const { runScheduledPublisher } = await import("../../../../lib/scheduled-publisher");
    const result = await runScheduledPublisher(schedulerBatchSize());
    return NextResponse.json({
      ok: true,
      source: request.headers.get("x-scheduler-source") || (request.method === "POST" ? "external" : "vercel-cron"),
      durationMs: Date.now() - startedAt,
      executedAt: new Date().toISOString(),
      ...result,
    }, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("scheduled social publisher failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Scheduled publisher failed.",
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
