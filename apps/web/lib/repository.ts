import { diagnoseCampaign } from "../../../packages/core/src/diagnostics";
import type { CampaignSnapshot, Lead } from "../../../packages/core/src/types";
import { memoryStore } from "./memory-store";
import type { ApprovalView, CampaignView, DashboardView, LeadView, SocialPlatform, SocialContentType, SocialPostView } from "./domain";
import { getPrisma } from "./prisma";
import { getSession } from "./auth";
import { recordAuditEvent } from "./audit";
import { brandIsWorkspaceScope } from "./tenant-scope";

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

async function databaseWorkspaceId() {
  const session = await getSession();
  if (!session?.workspaceId) throw new Error("WORKSPACE_SESSION_REQUIRED");
  return session.workspaceId;
}

function decimalToNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value ?? 0);
}

export async function createCampaignDraft(input: {
  name: string;
  channel: "meta" | "google";
  dailyBudget: number;
}): Promise<CampaignView> {
  const name = input.name.trim();
  if (!name) throw new Error("CAMPAIGN_NAME_REQUIRED");

  if (!usePostgres()) {
    const draft: CampaignSnapshot = {
      id: `draft_${Date.now()}`,
      name,
      channel: input.channel,
      status: "draft",
      dailyBudget: input.dailyBudget,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
    };
    memoryStore.campaigns.unshift(draft);
    return { ...draft, diagnosis: diagnoseCampaign(draft) };
  }

  const session = await getSession();
  if (!session?.workspaceId) throw new Error("WORKSPACE_SESSION_REQUIRED");
  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");

  const row = await prisma.campaign.create({
    data: {
      brandId: brand.id,
      channel: input.channel,
      name,
      status: "draft",
      dailyBudget: input.dailyBudget,
    },
  });

  await recordAuditEvent({
    workspaceId: session.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "campaign_draft_created",
    entityType: "Campaign",
    entityId: row.id,
    payload: {
      name: row.name,
      channel: row.channel,
      dailyBudget: input.dailyBudget,
    },
  });

  const snapshot: CampaignSnapshot = {
    id: row.id,
    name: row.name,
    channel: row.channel as CampaignSnapshot["channel"],
    status: "draft",
    dailyBudget: decimalToNumber(row.dailyBudget),
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
  };

  return { ...snapshot, diagnosis: diagnoseCampaign(snapshot) };
}

export async function listCampaigns(): Promise<CampaignView[]> {
  if (!usePostgres()) {
    return memoryStore.campaigns.map((campaign) => ({ ...campaign, diagnosis: diagnoseCampaign(campaign) }));
  }

  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const rows = await prisma.campaign.findMany({
    where: brandIsWorkspaceScope(workspaceId),
    include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => {
    const metric = row.metrics[0];
    const snapshot: CampaignSnapshot = {
      id: row.id,
      name: row.name,
      channel: row.channel as CampaignSnapshot["channel"],
      status: row.status as CampaignSnapshot["status"],
      dailyBudget: row.dailyBudget == null ? undefined : decimalToNumber(row.dailyBudget),
      spend: metric ? decimalToNumber(metric.spend) : 0,
      impressions: metric?.impressions ?? 0,
      clicks: metric?.clicks ?? 0,
      conversions: metric?.conversions ?? 0,
      revenue: metric ? decimalToNumber(metric.revenue) : 0,
      frequency: metric?.frequency == null ? undefined : decimalToNumber(metric.frequency),
    };
    return { ...snapshot, diagnosis: diagnoseCampaign(snapshot) };
  });
}

export async function listLeads(): Promise<LeadView[]> {
  if (!usePostgres()) return memoryStore.leads;
  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const rows = await prisma.lead.findMany({
    where: brandIsWorkspaceScope(workspaceId),
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.externalId ?? row.id,
    source: row.source as Lead["source"],
    customerName: row.name ?? undefined,
    message: row.message,
    intent: row.intent as Lead["intent"],
    status: row.status as Lead["status"],
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listSocialPosts(): Promise<SocialPostView[]> {
  if (!usePostgres()) return memoryStore.socialPosts;
  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const rows = await prisma.socialPost.findMany({
    where: brandIsWorkspaceScope(workspaceId),
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => {
    const meta = row.metadataJson && typeof row.metadataJson === "object" ? row.metadataJson as Record<string, unknown> : {};
    return {
      id: row.id,
      platform: row.platform as SocialPostView["platform"],
      contentType: row.contentType as SocialPostView["contentType"],
      title: row.title,
      caption: row.caption,
      status: row.status as SocialPostView["status"],
      scheduledAt: row.scheduledAt?.toISOString(),
      externalId: row.externalId ?? undefined,
      mediaUrl: typeof meta.mediaUrl === "string" ? meta.mediaUrl : undefined,
      linkUrl: typeof meta.linkUrl === "string" ? meta.linkUrl : undefined,
      hashtags: typeof meta.hashtags === "string" ? meta.hashtags : undefined,
      cta: typeof meta.cta === "string" ? meta.cta : undefined,
      altText: typeof meta.altText === "string" ? meta.altText : undefined,
      lastDeliveryError: typeof meta.lastDeliveryError === "string" ? meta.lastDeliveryError : undefined,
      lastDeliveryAttemptAt: typeof meta.lastDeliveryAttemptAt === "string" ? meta.lastDeliveryAttemptAt : undefined,
    };
  });
}

export async function createSocialPosts(input: {
  platforms: SocialPlatform[];
  contentType: SocialContentType;
  title: string;
  caption: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  scheduledAt?: string;
  externalId?: string;
  mediaUrl?: string;
  linkUrl?: string;
  hashtags?: string;
  cta?: string;
  altText?: string;
  tiktokPrivacyLevel?: string;
  youtubePrivacyStatus?: string;
  youtubeMadeForKids?: boolean;
  pinterestBoardId?: string;
}): Promise<SocialPostView[]> {
  const created = input.platforms.map((platform, index) => ({
    id: `sp_${Date.now()}_${index}`,
    platform,
    contentType: input.contentType,
    title: input.title,
    caption: input.caption,
    status: input.status,
    scheduledAt: input.scheduledAt,
    externalId: input.externalId,
    mediaUrl: input.mediaUrl,
    linkUrl: input.linkUrl,
    hashtags: input.hashtags,
    cta: input.cta,
    altText: input.altText,
  } satisfies SocialPostView));

  if (!usePostgres()) {
    memoryStore.socialPosts.unshift(...created);
    return created;
  }

  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  if (!brand) throw new Error("BRAND_NOT_FOUND");

  const rows = await Promise.all(input.platforms.map((platform) => prisma.socialPost.create({
    data: {
      brandId: brand.id,
      platform,
      contentType: input.contentType,
      title: input.title,
      caption: input.caption,
      status: input.status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      externalId: input.externalId || null,
      metadataJson: {
        mediaUrl: input.mediaUrl || null,
        linkUrl: input.linkUrl || null,
        hashtags: input.hashtags || null,
        cta: input.cta || null,
        altText: input.altText || null,
        tiktokPrivacyLevel: input.tiktokPrivacyLevel || null,
        youtubePrivacyStatus: input.youtubePrivacyStatus || null,
        youtubeMadeForKids: input.youtubeMadeForKids ?? null,
        pinterestBoardId: input.pinterestBoardId || null,
      },
    },
  })));

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform as SocialPlatform,
    contentType: row.contentType as SocialContentType,
    title: row.title,
    caption: row.caption,
    status: row.status as SocialPostView["status"],
    scheduledAt: row.scheduledAt?.toISOString(),
    externalId: row.externalId ?? undefined,
    mediaUrl: input.mediaUrl,
    linkUrl: input.linkUrl,
    hashtags: input.hashtags,
    cta: input.cta,
    altText: input.altText,
  }));
}

export async function getSocialPostById(id: string): Promise<SocialPostView | null> {
  if (!usePostgres()) return memoryStore.socialPosts.find((item) => item.id === id) ?? null;

  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const row = await prisma.socialPost.findFirst({ where: { id, ...brandIsWorkspaceScope(workspaceId) } });
  if (!row) return null;
  const meta = row.metadataJson && typeof row.metadataJson === "object" ? row.metadataJson as Record<string, unknown> : {};
  return {
    id: row.id,
    platform: row.platform as SocialPlatform,
    contentType: row.contentType as SocialContentType,
    title: row.title,
    caption: row.caption,
    status: row.status as SocialPostView["status"],
    scheduledAt: row.scheduledAt?.toISOString(),
    externalId: row.externalId ?? undefined,
    mediaUrl: typeof meta.mediaUrl === "string" ? meta.mediaUrl : undefined,
    linkUrl: typeof meta.linkUrl === "string" ? meta.linkUrl : undefined,
    hashtags: typeof meta.hashtags === "string" ? meta.hashtags : undefined,
    cta: typeof meta.cta === "string" ? meta.cta : undefined,
    altText: typeof meta.altText === "string" ? meta.altText : undefined,
    lastDeliveryError: typeof meta.lastDeliveryError === "string" ? meta.lastDeliveryError : undefined,
    lastDeliveryAttemptAt: typeof meta.lastDeliveryAttemptAt === "string" ? meta.lastDeliveryAttemptAt : undefined,
  };
}

export async function updateSocialPostDelivery(
  id: string,
  status: SocialPostView["status"],
  externalId?: string,
) {
  if (!usePostgres()) {
    const post = memoryStore.socialPosts.find((item) => item.id === id);
    if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
    post.status = status;
    if (externalId) post.externalId = externalId;
    return post;
  }

  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const post = await prisma.socialPost.findFirst({ where: { id, ...brandIsWorkspaceScope(workspaceId) } });
  if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
  await prisma.socialPost.update({
    where: { id },
    data: { status, ...(externalId ? { externalId } : {}) },
  });
}

export async function markSocialPostPublished(id: string, externalId: string) {
  return updateSocialPostDelivery(id, "published", externalId);
}

export async function listApprovals(): Promise<ApprovalView[]> {
  if (!usePostgres()) return memoryStore.approvals;
  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const rows = await prisma.approval.findMany({
    where: brandIsWorkspaceScope(workspaceId),
    include: { action: { include: { campaign: true } } },
    orderBy: { requestedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    brandId: row.brandId,
    campaignId: row.action.campaignId,
    campaignName: row.action.campaign.name,
    action: row.action.type as ApprovalView["action"],
    reason: row.action.reason,
    spendImpactPct: row.action.spendImpactPct == null ? undefined : decimalToNumber(row.action.spendImpactPct),
    confidence: decimalToNumber(row.action.confidence),
    status: row.status as ApprovalView["status"],
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString(),
    decidedBy: row.decidedBy ?? undefined,
  }));
}

export async function decideApproval(id: string, decision: "approved" | "rejected", decidedBy: string) {
  if (!usePostgres()) {
    const approval = memoryStore.approvals.find((item) => item.id === id);
    if (!approval) return null;
    approval.status = decision;
    approval.decidedAt = new Date().toISOString();
    approval.decidedBy = decidedBy;
    return approval;
  }

  const workspaceId = await databaseWorkspaceId();
  const prisma = getPrisma();
  const existing = await prisma.approval.findFirst({ where: { id, ...brandIsWorkspaceScope(workspaceId) } });
  if (!existing) return null;

  const approval = await prisma.approval.update({
    where: { id },
    data: { status: decision, decidedAt: new Date(), decidedBy },
    include: { action: true },
  });
  await prisma.optimizationAction.update({
    where: { id: approval.actionId },
    data: { status: decision === "approved" ? "approved" : "rejected" },
  });
  await prisma.auditLog.create({
    data: {
      brandId: approval.brandId,
      actorType: "user",
      actorId: decidedBy,
      action: `approval.${decision}`,
      entityType: "optimization_action",
      entityId: approval.actionId,
      payload: { approvalId: id },
    },
  });
  return approval;
}

export async function dashboardData(): Promise<DashboardView> {
  const [campaigns, leads, approvals] = await Promise.all([listCampaigns(), listLeads(), listApprovals()]);
  const spend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const revenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);

  let insights = memoryStore.insights;
  if (usePostgres()) {
    const workspaceId = await databaseWorkspaceId();
    const prisma = getPrisma();
    const rows = await prisma.marketingInsight.findMany({
      where: { resolvedAt: null, brand: { is: { workspaceId } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    insights = rows.map((row) => ({
      id: row.id,
      kind: row.kind as (typeof memoryStore.insights)[number]["kind"],
      title: row.title,
      detail: row.detail,
      severity: row.severity as (typeof memoryStore.insights)[number]["severity"],
    }));
  }

  return {
    spend,
    revenue,
    roas: spend ? revenue / spend : 0,
    leads: leads.length,
    pendingApprovals: approvals.filter((a) => a.status === "pending").length,
    campaignsNeedingAction: campaigns.filter((c) => c.diagnosis.health === "needs_action").length,
    insights,
  };
}
