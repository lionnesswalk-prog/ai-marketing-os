import type { AppSession } from "./auth";
import { getPrisma } from "./prisma";
import { getCurrentBrandProfile } from "./brand-profile";
import { createBrandStudioDraft } from "./brand-studio";
import { rescheduleSocialPost } from "./social-post-actions";
import { startScheduledSocialPostWorkflow } from "./social-workflow";
import type { PostingRecommendation, PostingWindow } from "./posting-intelligence";

export type CalendarPlatform = "instagram" | "facebook" | "pinterest";

export type ContentCalendarEntryInput = {
  dayOffset: number;
  platform: CalendarPlatform;
  theme: string;
  headline: string;
  subheadline: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualDirection: string;
  postingWindow: PostingWindow;
  timingReason: string;
  timingEvidence: "performance" | "test";
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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

function serializePlan(plan: {
  id: string;
  horizonDays: number;
  objective: string;
  focus: string | null;
  aiMode: string | null;
  timingJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    dayOffset: number;
    platform: string;
    theme: string;
    headline: string;
    subheadline: string;
    caption: string;
    cta: string;
    hashtags: unknown;
    visualDirection: string;
    postingWindow: string;
    timingReason: string;
    timingEvidence: string;
    socialPostId: string | null;
  }>;
}) {
  return {
    id: plan.id,
    horizonDays: plan.horizonDays,
    objective: plan.objective,
    focus: plan.focus || "",
    aiMode: plan.aiMode || undefined,
    timing: plan.timingJson,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    items: plan.items.map((item) => ({
      id: item.id,
      dayOffset: item.dayOffset,
      platform: item.platform as CalendarPlatform,
      theme: item.theme,
      headline: item.headline,
      subheadline: item.subheadline,
      caption: item.caption,
      cta: item.cta,
      hashtags: stringArray(item.hashtags),
      visualDirection: item.visualDirection,
      postingWindow: item.postingWindow as PostingWindow,
      timingReason: item.timingReason,
      timingEvidence: item.timingEvidence as "performance" | "test",
      socialPostId: item.socialPostId || undefined,
    })),
  };
}

export async function saveContentCalendarPlan(input: {
  session: AppSession;
  horizonDays: 7 | 30;
  objective: string;
  focus?: string;
  aiMode: string;
  timing: {
    updatedAt: string;
    timezoneOffsetMinutes: number;
    recommendations: PostingRecommendation[];
  };
  entries: ContentCalendarEntryInput[];
}) {
  const prisma = getPrisma();
  const brand = await currentBrand(input.session);
  const plan = await prisma.contentCalendarPlan.create({
    data: {
      brandId: brand.id,
      horizonDays: input.horizonDays,
      objective: input.objective,
      focus: input.focus || null,
      aiMode: input.aiMode,
      timingJson: input.timing as any,
      items: {
        create: input.entries.map((entry) => ({
          dayOffset: entry.dayOffset,
          platform: entry.platform,
          theme: entry.theme,
          headline: entry.headline,
          subheadline: entry.subheadline,
          caption: entry.caption,
          cta: entry.cta,
          hashtags: entry.hashtags,
          visualDirection: entry.visualDirection,
          postingWindow: entry.postingWindow,
          timingReason: entry.timingReason,
          timingEvidence: entry.timingEvidence,
        })),
      },
    },
    include: { items: { orderBy: [{ dayOffset: "asc" }, { createdAt: "asc" }] } },
  });
  return serializePlan(plan);
}

export async function getLatestContentCalendarPlan(session: AppSession) {
  const brand = await currentBrand(session);
  const plan = await getPrisma().contentCalendarPlan.findFirst({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: [{ dayOffset: "asc" }, { createdAt: "asc" }] } },
  });
  return plan ? serializePlan(plan) : null;
}

async function recoverCalendarPost(brandId: string, calendarItemId: string) {
  const rows = await getPrisma().socialPost.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, metadataJson: true },
  });
  return rows.find((row) => {
    if (!row.metadataJson || typeof row.metadataJson !== "object" || Array.isArray(row.metadataJson)) return false;
    return (row.metadataJson as Record<string, unknown>).sourceCalendarItemId === calendarItemId;
  })?.id;
}

export async function materializeContentCalendarPlan(input: {
  session: AppSession;
  planId: string;
  fallbackOrigin: string;
  schedule?: Record<string, string>;
}) {
  const prisma = getPrisma();
  const plan = await prisma.contentCalendarPlan.findFirst({
    where: {
      id: input.planId,
      brand: { is: { workspaceId: input.session.workspaceId } },
    },
    include: {
      brand: { select: { id: true } },
      items: { orderBy: [{ dayOffset: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!plan) throw new Error("CONTENT_CALENDAR_NOT_FOUND");

  const profile = await getCurrentBrandProfile(input.session);
  const results: Array<{
    itemId: string;
    socialPostId?: string;
    status: "draft" | "scheduled" | "schedule_failed";
    warning?: string;
  }> = [];

  for (const item of plan.items) {
    let postId = item.socialPostId || undefined;

    if (!postId) {
      postId = await recoverCalendarPost(plan.brand.id, item.id);
      if (postId) {
        await prisma.contentCalendarItem.update({
          where: { id: item.id },
          data: { socialPostId: postId },
        });
      }
    }

    if (!postId) {
      const draft = await createBrandStudioDraft({
        session: input.session,
        profile,
        fallbackOrigin: input.fallbackOrigin,
        aiMode: plan.aiMode || "calendar",
        sourceCalendarPlanId: plan.id,
        sourceCalendarItemId: item.id,
        post: {
          platform: item.platform as CalendarPlatform,
          headline: item.headline,
          subheadline: item.subheadline,
          caption: item.caption,
          cta: item.cta,
          hashtags: stringArray(item.hashtags),
          visualDirection: item.visualDirection,
          postingWindow: item.postingWindow as PostingWindow,
          suggestedDayOffset: item.dayOffset,
          timingReason: item.timingReason,
        },
      });
      postId = draft.postId;
      await prisma.contentCalendarItem.update({
        where: { id: item.id },
        data: { socialPostId: postId },
      });
    }

    const scheduledAt = input.schedule?.[item.id];
    if (!scheduledAt) {
      results.push({ itemId: item.id, socialPostId: postId, status: "draft" });
      continue;
    }

    try {
      await rescheduleSocialPost(postId, scheduledAt);
      try {
        await startScheduledSocialPostWorkflow(postId, scheduledAt);
        results.push({ itemId: item.id, socialPostId: postId, status: "scheduled" });
      } catch (workflowError) {
        console.error("calendar durable schedule activation failed", { postId, workflowError });
        results.push({
          itemId: item.id,
          socialPostId: postId,
          status: "scheduled",
          warning: "Durable exact-time delivery could not be armed; the recovery scheduler remains the fallback.",
        });
      }
    } catch (error) {
      results.push({
        itemId: item.id,
        socialPostId: postId,
        status: "schedule_failed",
        warning: error instanceof Error ? error.message : "Unable to schedule this post.",
      });
    }
  }

  return {
    planId: plan.id,
    results,
    drafts: results.filter((item) => item.status === "draft").length,
    scheduled: results.filter((item) => item.status === "scheduled").length,
    scheduleFailed: results.filter((item) => item.status === "schedule_failed").length,
  };
}
