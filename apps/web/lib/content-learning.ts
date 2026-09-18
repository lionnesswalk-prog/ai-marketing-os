import type { AppSession } from "./auth";
import type { ContentAnalytics, SocialAnalyticsView } from "./social-analytics-types";
import { getSocialAnalytics } from "./social-analytics";
import { getPrisma } from "./prisma";

type LearningMetrics = {
  views: number;
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export type ContentLearningExample = {
  socialPostId: string;
  platform: string;
  theme?: string;
  headline: string;
  publishedAt?: string;
  engagementScore: number;
  metrics: LearningMetrics;
};

export type ContentLearningPlatformSummary = {
  platform: string;
  sampleSize: number;
  examples: ContentLearningExample[];
};

export type ContentLearningSummary = {
  matchedPostCount: number;
  evidence: "learning" | "insufficient";
  updatedAt?: string;
  platformSummaries: ContentLearningPlatformSummary[];
  note: string;
};

function metrics(item: ContentAnalytics): LearningMetrics {
  return {
    views: Number(item.views || 0),
    impressions: Number(item.impressions || 0),
    engagements: Number(item.engagements || 0),
    likes: Number(item.likes || 0),
    comments: Number(item.comments || 0),
    shares: Number(item.shares || 0),
    saves: Number(item.saves || 0),
  };
}

export function contentEngagementScore(item: Pick<ContentAnalytics,
  "views" | "impressions" | "engagements" | "likes" | "comments" | "shares" | "saves"
>) {
  return Number(item.views || 0) +
    Number(item.impressions || 0) +
    Number(item.engagements || 0) * 4 +
    Number(item.likes || 0) * 3 +
    Number(item.comments || 0) * 5 +
    Number(item.shares || 0) * 6 +
    Number(item.saves || 0) * 5;
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function serializeMetrics(value: unknown): LearningMetrics {
  const raw = recordObject(value);
  return {
    views: numberValue(raw.views),
    impressions: numberValue(raw.impressions),
    engagements: numberValue(raw.engagements),
    likes: numberValue(raw.likes),
    comments: numberValue(raw.comments),
    shares: numberValue(raw.shares),
    saves: numberValue(raw.saves),
  };
}

async function currentBrand(session: AppSession) {
  const brand = await getPrisma().brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return brand;
}

export async function getContentLearningSummary(session: AppSession): Promise<ContentLearningSummary> {
  const brand = await currentBrand(session);
  const rows = await getPrisma().contentPerformanceSnapshot.findMany({
    where: { brandId: brand.id },
    orderBy: [{ capturedAt: "desc" }],
    take: 120,
  });

  const byPlatform = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byPlatform.get(row.platform) || [];
    list.push(row);
    byPlatform.set(row.platform, list);
  }

  const platformSummaries = [...byPlatform.entries()]
    .map(([platform, items]) => ({
      platform,
      sampleSize: items.length,
      examples: [...items]
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 3)
        .map((item) => ({
          socialPostId: item.socialPostId,
          platform: item.platform,
          theme: item.theme || undefined,
          headline: item.headline,
          publishedAt: item.publishedAt?.toISOString(),
          engagementScore: item.engagementScore,
          metrics: serializeMetrics(item.metricsJson),
        })),
    }))
    .sort((a, b) => b.sampleSize - a.sampleSize);

  const matchedPostCount = rows.length;
  return {
    matchedPostCount,
    evidence: matchedPostCount >= 3 ? "learning" : "insufficient",
    updatedAt: rows[0]?.capturedAt.toISOString(),
    platformSummaries,
    note: matchedPostCount >= 3
      ? "The learning loop is using verified matches between portal-published posts and live provider analytics. Strong examples are descriptive recent evidence, not proof that a theme or platform caused the result."
      : "Fewer than three portal-published posts have verified provider-performance matches. The system will keep learning, but it will not treat current examples as a reliable winning pattern yet.",
  };
}

export function buildContentLearningContext(summary: ContentLearningSummary) {
  if (!summary.matchedPostCount) {
    return "CONTENT LEARNING: No portal-published posts have verified provider-performance matches yet. Keep the next plan exploratory and do not claim learned winners.";
  }

  const sections = summary.platformSummaries.map((platform) => {
    const examples = platform.examples.map((example, index) => {
      const label = example.theme || example.headline;
      const m = example.metrics;
      return [
        `${index + 1}. ${label}`,
        `observed metrics: views ${m.views}, impressions ${m.impressions}, engagements ${m.engagements}, likes ${m.likes}, comments ${m.comments}, shares ${m.shares}, saves ${m.saves}`,
      ].join(" · ");
    }).join("\n");

    return `${platform.platform} · matched posts: ${platform.sampleSize}\n${examples}`;
  });

  return [
    `CONTENT LEARNING: ${summary.matchedPostCount} verified portal→provider performance matches.`,
    summary.evidence === "learning"
      ? "Use the strongest recent examples as directional evidence. Reuse useful strategic patterns, not exact wording, and preserve experimentation."
      : "Evidence is still sparse. Treat examples as observations only and preserve broad experimentation.",
    ...sections,
    "Do not compare raw engagement scores across platforms as if they were directly equivalent, and do not infer causation from correlation.",
  ].join("\n\n");
}

export async function refreshContentLearning(session: AppSession): Promise<{
  analytics: SocialAnalyticsView;
  summary: ContentLearningSummary;
  matchedThisRefresh: number;
}> {
  const prisma = getPrisma();
  const brand = await currentBrand(session);
  const analytics = await getSocialAnalytics();

  const posts = await prisma.socialPost.findMany({
    where: {
      brandId: brand.id,
      status: "published",
      externalId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
    select: {
      id: true,
      platform: true,
      title: true,
      externalId: true,
      updatedAt: true,
    },
  });

  const byProviderKey = new Map(
    posts
      .filter((post) => Boolean(post.externalId))
      .map((post) => [`${post.platform}:${post.externalId}`, post] as const),
  );

  const matched = analytics.recentContent.flatMap((item) => {
    const post = byProviderKey.get(`${item.platform}:${item.id}`);
    return post ? [{ item, post }] : [];
  });

  const calendarItems = matched.length
    ? await prisma.contentCalendarItem.findMany({
        where: { socialPostId: { in: matched.map(({ post }) => post.id) } },
        select: { socialPostId: true, theme: true },
      })
    : [];
  const themeByPost = new Map(
    calendarItems
      .filter((item): item is typeof item & { socialPostId: string } => Boolean(item.socialPostId))
      .map((item) => [item.socialPostId, item.theme]),
  );

  for (const { item, post } of matched) {
    const itemMetrics = metrics(item);
    const publishedAt = item.publishedAt && Number.isFinite(Date.parse(item.publishedAt))
      ? new Date(item.publishedAt)
      : null;

    await prisma.contentPerformanceSnapshot.upsert({
      where: { socialPostId: post.id },
      create: {
        brandId: brand.id,
        socialPostId: post.id,
        providerContentId: item.id,
        platform: item.platform,
        theme: themeByPost.get(post.id) || null,
        headline: post.title || item.title,
        publishedAt,
        metricsJson: itemMetrics as any,
        engagementScore: contentEngagementScore(item),
      },
      update: {
        providerContentId: item.id,
        platform: item.platform,
        theme: themeByPost.get(post.id) || null,
        headline: post.title || item.title,
        publishedAt,
        metricsJson: itemMetrics as any,
        engagementScore: contentEngagementScore(item),
      },
    });
  }

  return {
    analytics,
    summary: await getContentLearningSummary(session),
    matchedThisRefresh: matched.length,
  };
}
