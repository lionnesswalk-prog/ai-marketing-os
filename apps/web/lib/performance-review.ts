import type { AppSession } from "./auth";
import { getPrisma } from "./prisma";
import { refreshContentLearningForBrand } from "./content-learning";
import { buildWeeklyPerformanceReview } from "../../../packages/agents/src/runtime";

type SnapshotRow = {
  id: string;
  platform: string;
  theme: string | null;
  headline: string;
  publishedAt: Date | null;
  engagementScore: number;
};

type CohortPlatform = {
  platform: string;
  count: number;
  directionalIndexAvg: number;
};

export type WeeklyPerformanceEvidence = {
  periodKey: string;
  periodEnd: string;
  matchedPublishedPosts: number;
  recent7: CohortPlatform[];
  previous7: CohortPlatform[];
  recent30: CohortPlatform[];
  previous30: CohortPlatform[];
  comparisons: Array<{
    platform: string;
    recent7Count: number;
    previous7Count: number;
    recent7DirectionalIndexAvg?: number;
    previous7DirectionalIndexAvg?: number;
    sevenDayDeltaPct?: number;
    recent30Count: number;
    previous30Count: number;
    recent30DirectionalIndexAvg?: number;
    previous30DirectionalIndexAvg?: number;
    thirtyDayDeltaPct?: number;
  }>;
  strongestRecentByPlatform: Array<{
    platform: string;
    examples: Array<{
      label: string;
      publishedAt?: string;
      directionalIndex: number;
    }>;
  }>;
  caveats: string[];
};

export type WeeklyPerformanceReviewView = {
  id: string;
  periodKey: string;
  periodEnd: string;
  aiMode?: string;
  createdAt: string;
  updatedAt: string;
  evidence: WeeklyPerformanceEvidence;
  review: {
    evidenceStatus: "learning" | "insufficient";
    headline: string;
    executiveSummary: string;
    improvements: Array<{ title: string; evidence: string }>;
    weakSignals: Array<{ title: string; evidence: string }>;
    experiments: Array<{ hypothesis: string; action: string; successSignal: string }>;
    nextWeekPriorities: string[];
  };
};

function weekStartUtc(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - mondayOffset);
  return copy;
}

export function weeklyReviewPeriodKey(date = new Date()) {
  return weekStartUtc(date).toISOString().slice(0, 10);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function inRange(row: SnapshotRow, start: Date, end: Date) {
  const value = row.publishedAt?.getTime();
  return typeof value === "number" && value >= start.getTime() && value < end.getTime();
}

function summarize(rows: SnapshotRow[], start: Date, end: Date): CohortPlatform[] {
  const byPlatform = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    if (!inRange(row, start, end)) continue;
    const list = byPlatform.get(row.platform) || [];
    list.push(row);
    byPlatform.set(row.platform, list);
  }

  return [...byPlatform.entries()]
    .map(([platform, items]) => ({
      platform,
      count: items.length,
      directionalIndexAvg: rounded(average(items.map((item) => item.engagementScore))),
    }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

function summaryMap(items: CohortPlatform[]) {
  return new Map(items.map((item) => [item.platform, item]));
}

function deltaPct(current: CohortPlatform | undefined, previous: CohortPlatform | undefined) {
  if (!current || !previous || current.count < 2 || previous.count < 2 || previous.directionalIndexAvg <= 0) {
    return undefined;
  }
  return rounded(((current.directionalIndexAvg - previous.directionalIndexAvg) / previous.directionalIndexAvg) * 100);
}

export async function buildWeeklyPerformanceEvidence(
  brandId: string,
  periodEnd = new Date(),
): Promise<WeeklyPerformanceEvidence> {
  const prisma = getPrisma();
  const end = new Date(periodEnd);
  const start7 = new Date(end.getTime() - 7 * 86_400_000);
  const start14 = new Date(end.getTime() - 14 * 86_400_000);
  const start30 = new Date(end.getTime() - 30 * 86_400_000);
  const start60 = new Date(end.getTime() - 60 * 86_400_000);

  const rows = await prisma.contentPerformanceSnapshot.findMany({
    where: {
      brandId,
      publishedAt: { gte: start60, lt: end },
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      platform: true,
      theme: true,
      headline: true,
      publishedAt: true,
      engagementScore: true,
    },
  });

  const recent7 = summarize(rows, start7, end);
  const previous7 = summarize(rows, start14, start7);
  const recent30 = summarize(rows, start30, end);
  const previous30 = summarize(rows, start60, start30);

  const r7 = summaryMap(recent7);
  const p7 = summaryMap(previous7);
  const r30 = summaryMap(recent30);
  const p30 = summaryMap(previous30);
  const platforms = [...new Set([
    ...r7.keys(),
    ...p7.keys(),
    ...r30.keys(),
    ...p30.keys(),
  ])].sort();

  const comparisons = platforms.map((platform) => {
    const current7 = r7.get(platform);
    const prior7 = p7.get(platform);
    const current30 = r30.get(platform);
    const prior30 = p30.get(platform);
    return {
      platform,
      recent7Count: current7?.count || 0,
      previous7Count: prior7?.count || 0,
      recent7DirectionalIndexAvg: current7?.directionalIndexAvg,
      previous7DirectionalIndexAvg: prior7?.directionalIndexAvg,
      sevenDayDeltaPct: deltaPct(current7, prior7),
      recent30Count: current30?.count || 0,
      previous30Count: prior30?.count || 0,
      recent30DirectionalIndexAvg: current30?.directionalIndexAvg,
      previous30DirectionalIndexAvg: prior30?.directionalIndexAvg,
      thirtyDayDeltaPct: deltaPct(current30, prior30),
    };
  });

  const strongestRecentByPlatform = platforms.flatMap((platform) => {
    const examples = rows
      .filter((row) => row.platform === platform && inRange(row, start30, end))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 3)
      .map((row) => ({
        label: row.theme || row.headline,
        publishedAt: row.publishedAt?.toISOString(),
        directionalIndex: rounded(row.engagementScore),
      }));
    return examples.length ? [{ platform, examples }] : [];
  });

  return {
    periodKey: weeklyReviewPeriodKey(end),
    periodEnd: end.toISOString(),
    matchedPublishedPosts: rows.length,
    recent7,
    previous7,
    recent30,
    previous30,
    comparisons,
    strongestRecentByPlatform,
    caveats: [
      "Directional engagement indexes are only compared within the same platform; they are not treated as equivalent across platforms.",
      "Newer posts have had less time to accumulate provider metrics, so cohort differences are observations rather than proof of improvement or decline.",
      "Small cohorts can create unstable percentage changes; deltas are omitted unless both compared cohorts contain at least two verified posts.",
      "Only portal-published posts with exact provider content-ID matches are included.",
    ],
  };
}

function reviewEvidenceContext(evidence: WeeklyPerformanceEvidence) {
  return [
    "WEEKLY PERFORMANCE EVIDENCE",
    JSON.stringify(evidence, null, 2),
    "Interpret directionalIndexAvg only within the same platform. Respect every caveat supplied in the evidence.",
  ].join("\n\n");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function reviewView(row: {
  id: string;
  periodKey: string;
  periodEnd: Date;
  aiMode: string | null;
  evidenceJson: unknown;
  reviewJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): WeeklyPerformanceReviewView {
  return {
    id: row.id,
    periodKey: row.periodKey,
    periodEnd: row.periodEnd.toISOString(),
    aiMode: row.aiMode || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    evidence: row.evidenceJson as WeeklyPerformanceEvidence,
    review: row.reviewJson as WeeklyPerformanceReviewView["review"],
  };
}

export async function generateWeeklyPerformanceReviewForBrand(
  brandId: string,
  options?: { refreshLearning?: boolean; now?: Date },
) {
  if (options?.refreshLearning !== false) {
    await refreshContentLearningForBrand(brandId).catch((error) => {
      console.error("weekly review learning refresh failed", {
        brandId,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }

  const prisma = getPrisma();
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, name: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");

  const now = options?.now || new Date();
  const evidence = await buildWeeklyPerformanceEvidence(brandId, now);
  const evidenceStatus = evidence.matchedPublishedPosts >= 3 ? "learning" as const : "insufficient" as const;
  const result = await buildWeeklyPerformanceReview({
    brandName: brand.name,
    evidenceStatus,
    matchedPostCount: evidence.matchedPublishedPosts,
    evidenceContext: reviewEvidenceContext(evidence),
  });

  const row = await prisma.weeklyPerformanceReview.upsert({
    where: {
      brandId_periodKey: {
        brandId,
        periodKey: evidence.periodKey,
      },
    },
    create: {
      brandId,
      periodKey: evidence.periodKey,
      periodEnd: now,
      aiMode: result.mode,
      evidenceJson: evidence as any,
      reviewJson: result.output as any,
    },
    update: {
      periodEnd: now,
      aiMode: result.mode,
      evidenceJson: evidence as any,
      reviewJson: result.output as any,
    },
  });

  return {
    ...reviewView(row),
    warning: result.warning,
  };
}

export async function getLatestWeeklyPerformanceReviewForBrand(brandId: string) {
  const row = await getPrisma().weeklyPerformanceReview.findFirst({
    where: { brandId },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
  });
  return row ? reviewView(row) : null;
}

export async function getLatestWeeklyPerformanceReview(session: AppSession) {
  const brand = await getPrisma().brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return getLatestWeeklyPerformanceReviewForBrand(brand.id);
}

export async function runDueWeeklyPerformanceReviews(limit = 6) {
  const prisma = getPrisma();
  const periodKey = weeklyReviewPeriodKey();
  const brands = await prisma.brand.findMany({
    where: {
      socialPosts: { some: { status: "published" } },
      performanceReviews: { none: { periodKey } },
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 12)),
    select: { id: true, name: true },
  });

  const results: Array<{ brandId: string; brandName: string; ok: boolean; error?: string }> = [];
  for (const brand of brands) {
    try {
      await generateWeeklyPerformanceReviewForBrand(brand.id, { refreshLearning: true });
      results.push({ brandId: brand.id, brandName: brand.name, ok: true });
    } catch (error) {
      results.push({
        brandId: brand.id,
        brandName: brand.name,
        ok: false,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return {
    periodKey,
    processed: results.length,
    succeeded: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}
