import { NextResponse } from "next/server";
import { schedulerBatchSize } from "../../../../lib/scheduler-config";
import { getPrisma } from "../../../../lib/prisma";
import { isPostgresBackend } from "../../../../lib/runtime-mode";
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

async function startInvocation(source: string) {
  if (!isPostgresBackend()) return null;
  try {
    return await getPrisma().schedulerInvocation.create({
      data: { source, status: "running" },
      select: { id: true },
    });
  } catch (error) {
    console.error("scheduler invocation start logging failed", error);
    return null;
  }
}

async function finishInvocation(
  id: string | undefined,
  data: {
    status: "success" | "failed";
    durationMs: number;
    claimed?: number;
    published?: number;
    processing?: number;
    failed?: number;
    recovered?: number;
    error?: string;
  },
) {
  if (!id || process.env.DATA_BACKEND !== "postgres") return;
  try {
    await getPrisma().schedulerInvocation.update({
      where: { id },
      data: {
        status: data.status,
        finishedAt: new Date(),
        durationMs: data.durationMs,
        claimed: data.claimed ?? 0,
        published: data.published ?? 0,
        processing: data.processing ?? 0,
        failed: data.failed ?? 0,
        recovered: data.recovered ?? 0,
        error: data.error,
      },
    });
  } catch (error) {
    console.error("scheduler invocation finish logging failed", error);
  }
}

async function run(request: Request) {
  const authorization = await authorize(request);
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized scheduler invocation." }, { status: 401 });
  }

  const source = request.headers.get("x-vercel-cron-schedule")
    ? "vercel-cron"
    : authorization.source;
  const startedAt = Date.now();
  const invocation = await startInvocation(source);

  try {
    const { runScheduledPublisher } = await import("../../../../lib/scheduled-publisher");
    const result = await runScheduledPublisher(schedulerBatchSize());
    const durationMs = Date.now() - startedAt;
    await finishInvocation(invocation?.id, {
      status: "success",
      durationMs,
      ...result,
    });

    return NextResponse.json({
      ok: true,
      source,
      durationMs,
      executedAt: new Date().toISOString(),
      ...result,
    }, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Scheduled publisher failed.";
    await finishInvocation(invocation?.id, {
      status: "failed",
      durationMs,
      error: message,
    });
    console.error("scheduled social publisher failed", error);
    return NextResponse.json({
      error: "Scheduled publisher failed.",
      durationMs,
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
