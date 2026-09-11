import type { AppSession } from "./auth";
import { canManageMarketing } from "./auth";
import { memoryStore } from "./memory-store";
import { getPrisma } from "./prisma";
import { getSocialPlatforms } from "./social-platforms";
import { classifyQueueHealth } from "./operations-health";
import { schedulerAuthReady, schedulerCadenceLabel, schedulerExternalEnabled } from "./scheduler-config";

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function iso(value: Date | string | undefined | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export type OperationsIssue = {
  id: string;
  platform: string;
  title: string;
  status: string;
  scheduledAt?: string;
  updatedAt?: string;
  lastDeliveryAttemptAt?: string;
  error?: string;
  externalId?: string;
};

export type OperationsOverview = {
  queueHealth: ReturnType<typeof classifyQueueHealth>;
  counts: {
    draft: number;
    scheduled: number;
    publishing: number;
    published: number;
    failed: number;
    overdueScheduled: number;
    stalePublishing: number;
    longProcessing: number;
    failedLast24h: number;
  };
  nextScheduledAt?: string;
  oldestOverdueAt?: string;
  scheduler: {
    authenticated: boolean;
    cadence: string;
    externalEnabled: boolean;
    manualRunAvailable: boolean;
  };
  providers: Array<{
    id: string;
    name: string;
    connected: boolean;
    setupReady: boolean;
    connectionCheckFailed: boolean;
    accountLabel?: string;
  }>;
  recentIssues: OperationsIssue[];
};

export async function getOperationsOverview(session: AppSession): Promise<OperationsOverview> {
  if (!canManageMarketing(session.role)) throw new Error("OPERATIONS_ACCESS_DENIED");

  const platforms = await getSocialPlatforms();
  const providers = platforms.map((platform) => ({
    id: platform.id,
    name: platform.name,
    connected: platform.connected,
    setupReady: Boolean(platform.setupReady),
    connectionCheckFailed: Boolean(platform.connectionCheckFailed),
    accountLabel: platform.accountLabel,
  }));

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  const longBefore = new Date(now.getTime() - 60 * 60_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);

  if (process.env.DATA_BACKEND !== "postgres") {
    const posts = memoryStore.socialPosts;
    const overdue = posts.filter((post) => post.status === "scheduled" && post.scheduledAt && new Date(post.scheduledAt) <= now);
    const publishing = posts.filter((post) => post.status === "publishing");
    const failed = posts.filter((post) => post.status === "failed");
    const failedLast24h = failed.filter((post) => {
      const attempted = post.lastDeliveryAttemptAt ? new Date(post.lastDeliveryAttemptAt) : undefined;
      return attempted && Number.isFinite(attempted.getTime()) && attempted >= dayAgo;
    }).length;
    const stalePublishing = publishing.filter((post) => !post.externalId && post.lastDeliveryAttemptAt && new Date(post.lastDeliveryAttemptAt) <= staleBefore).length;
    const longProcessing = publishing.filter((post) => Boolean(post.externalId) && post.lastDeliveryAttemptAt && new Date(post.lastDeliveryAttemptAt) <= longBefore).length;
    const future = posts
      .filter((post) => post.status === "scheduled" && post.scheduledAt && new Date(post.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    const recentIssues = posts
      .filter((post) => post.status === "failed" || post.status === "publishing")
      .slice(0, 10)
      .map((post): OperationsIssue => ({
        id: post.id,
        platform: post.platform,
        title: post.title,
        status: post.status,
        scheduledAt: post.scheduledAt,
        lastDeliveryAttemptAt: post.lastDeliveryAttemptAt,
        error: post.lastDeliveryError,
        externalId: post.externalId,
      }));

    const counts = {
      draft: posts.filter((post) => post.status === "draft").length,
      scheduled: posts.filter((post) => post.status === "scheduled").length,
      publishing: publishing.length,
      published: posts.filter((post) => post.status === "published").length,
      failed: failed.length,
      overdueScheduled: overdue.length,
      stalePublishing,
      longProcessing,
      failedLast24h,
    };

    return {
      queueHealth: classifyQueueHealth(counts),
      counts,
      nextScheduledAt: future[0]?.scheduledAt,
      oldestOverdueAt: overdue.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0]?.scheduledAt,
      scheduler: {
        authenticated: schedulerAuthReady(),
        cadence: schedulerCadenceLabel(),
        externalEnabled: schedulerExternalEnabled(),
        manualRunAvailable: true,
      },
      providers,
      recentIssues,
    };
  }

  const prisma = getPrisma();
  const workspaceFilter = { brand: { is: { workspaceId: session.workspaceId } } };

  const [
    draft,
    scheduled,
    publishing,
    published,
    failed,
    overdueScheduled,
    stalePublishing,
    longProcessing,
    failedLast24h,
    nextScheduled,
    oldestOverdue,
    issueRows,
  ] = await Promise.all([
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "draft" } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "scheduled" } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "publishing" } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "published" } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "failed" } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "scheduled", scheduledAt: { lte: now } } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "publishing", externalId: null, updatedAt: { lte: staleBefore } } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "publishing", externalId: { not: null }, updatedAt: { lte: longBefore } } }),
    prisma.socialPost.count({ where: { ...workspaceFilter, status: "failed", updatedAt: { gte: dayAgo } } }),
    prisma.socialPost.findFirst({
      where: { ...workspaceFilter, status: "scheduled", scheduledAt: { gt: now } },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
    }),
    prisma.socialPost.findFirst({
      where: { ...workspaceFilter, status: "scheduled", scheduledAt: { lte: now } },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
    }),
    prisma.socialPost.findMany({
      where: { ...workspaceFilter, status: { in: ["failed", "publishing"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        platform: true,
        title: true,
        status: true,
        scheduledAt: true,
        updatedAt: true,
        externalId: true,
        metadataJson: true,
      },
    }),
  ]);

  const counts = {
    draft,
    scheduled,
    publishing,
    published,
    failed,
    overdueScheduled,
    stalePublishing,
    longProcessing,
    failedLast24h,
  };

  return {
    queueHealth: classifyQueueHealth(counts),
    counts,
    nextScheduledAt: iso(nextScheduled?.scheduledAt),
    oldestOverdueAt: iso(oldestOverdue?.scheduledAt),
    scheduler: {
      authenticated: schedulerAuthReady(),
      cadence: schedulerCadenceLabel(),
      externalEnabled: schedulerExternalEnabled(),
      manualRunAvailable: true,
    },
    providers,
    recentIssues: issueRows.map((row): OperationsIssue => {
      const meta = metadata(row.metadataJson);
      return {
        id: row.id,
        platform: row.platform,
        title: row.title,
        status: row.status,
        scheduledAt: iso(row.scheduledAt),
        updatedAt: iso(row.updatedAt),
        lastDeliveryAttemptAt: typeof meta.lastDeliveryAttemptAt === "string" ? meta.lastDeliveryAttemptAt : undefined,
        error: typeof meta.lastDeliveryError === "string" ? meta.lastDeliveryError : undefined,
        externalId: row.externalId || undefined,
      };
    }),
  };
}
