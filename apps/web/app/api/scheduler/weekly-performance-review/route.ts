import { NextResponse } from "next/server";
import {
  matchesSchedulerSharedSecret,
  verifyGitHubSchedulerOidcToken,
} from "../../../../lib/github-scheduler-oidc";
import { runDueWeeklyPerformanceReviews } from "../../../../lib/performance-review";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  if (matchesSchedulerSharedSecret(token, process.env.CRON_SECRET)) {
    return { source: "shared-secret" as const };
  }
  if (await verifyGitHubSchedulerOidcToken(token)) {
    return { source: "github-actions-oidc" as const };
  }
  return null;
}

function batchSize() {
  const value = Number(process.env.WEEKLY_REVIEW_BATCH_SIZE || "3");
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(Math.floor(value), 8));
}

async function run(request: Request) {
  const authorized = await authorize(request);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized scheduler invocation." }, { status: 401 });
  }

  const source = request.headers.get("x-vercel-cron-schedule")
    ? "vercel-cron"
    : authorized.source;
  const startedAt = Date.now();

  try {
    const result = await runDueWeeklyPerformanceReviews(batchSize());
    return NextResponse.json({
      ok: true,
      source,
      durationMs: Date.now() - startedAt,
      executedAt: new Date().toISOString(),
      ...result,
    }, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("weekly performance review scheduler failed", error);
    return NextResponse.json({
      error: "Weekly performance review scheduler failed.",
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
