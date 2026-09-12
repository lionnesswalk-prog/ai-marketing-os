import { NextResponse } from "next/server";
import { schedulerBatchSize } from "../../../../lib/scheduler-config";
import {
  matchesSchedulerSharedSecret,
  verifyGitHubSchedulerOidcToken,
} from "../../../../lib/github-scheduler-oidc";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  if (matchesSchedulerSharedSecret(token, process.env.CRON_SECRET)) {
    return { source: "shared-secret" };
  }

  if (await verifyGitHubSchedulerOidcToken(token)) {
    return { source: "github-actions-oidc" };
  }

  return null;
}

async function run(request: Request) {
  const authorization = await authorize(request);
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized scheduler invocation." }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const { runScheduledPublisher } = await import("../../../../lib/scheduled-publisher");
    const result = await runScheduledPublisher(schedulerBatchSize());
    return NextResponse.json({
      ok: true,
      source: authorization.source,
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
