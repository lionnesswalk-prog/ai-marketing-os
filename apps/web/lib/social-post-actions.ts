import { getSession } from "./auth";
import { memoryStore } from "./memory-store";
import { getPrisma } from "./prisma";
import { deliverSocialPost } from "./scheduled-publisher";
import { getStoredSocialPostDeliveryIssues, socialDeliveryIssueMessage } from "./social-preflight";

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

async function workspaceId() {
  const session = await getSession();
  if (!session?.workspaceId) throw new Error("WORKSPACE_SESSION_REQUIRED");
  return session.workspaceId;
}

export async function retrySocialPostNow(id: string) {
  if (!usePostgres()) {
    const post = memoryStore.socialPosts.find((item) => item.id === id);
    if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
    if (post.status !== "failed") throw new Error("SOCIAL_POST_NOT_FAILED");
    post.status = "draft";
    return { status: "draft" as const, preview: true };
  }

  const prisma = getPrisma();
  const currentWorkspaceId = await workspaceId();
  const post = await prisma.socialPost.findFirst({
    where: { id, brand: { is: { workspaceId: currentWorkspaceId } } },
  });
  if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
  if (post.status !== "failed") throw new Error("SOCIAL_POST_NOT_FAILED");

  const retryIssues = getStoredSocialPostDeliveryIssues(post);
  if (retryIssues.length) {
    throw new Error("SOCIAL_POST_PREFLIGHT_FAILED::" + socialDeliveryIssueMessage(retryIssues));
  }

  const claim = await prisma.socialPost.updateMany({
    where: { id, status: "failed" },
    data: { status: "publishing", scheduledAt: null },
  });
  if (claim.count !== 1) throw new Error("SOCIAL_POST_RETRY_CONFLICT");

  const status = await deliverSocialPost(post);
  return { status, preview: false };
}

export async function rescheduleSocialPost(id: string, scheduledAt: string) {
  const when = new Date(scheduledAt);
  if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) {
    throw new Error("SOCIAL_POST_SCHEDULE_INVALID");
  }

  if (!usePostgres()) {
    const post = memoryStore.socialPosts.find((item) => item.id === id);
    if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
    if (!["failed", "draft", "scheduled"].includes(post.status)) throw new Error("SOCIAL_POST_NOT_RESCHEDULABLE");
    post.status = "scheduled";
    post.scheduledAt = when.toISOString();
    return post;
  }

  const prisma = getPrisma();
  const currentWorkspaceId = await workspaceId();
  const post = await prisma.socialPost.findFirst({
    where: { id, brand: { is: { workspaceId: currentWorkspaceId } } },
  });
  if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
  if (!["failed", "draft", "scheduled"].includes(post.status)) throw new Error("SOCIAL_POST_NOT_RESCHEDULABLE");

  const scheduleIssues = getStoredSocialPostDeliveryIssues(post);
  if (scheduleIssues.length) {
    throw new Error("SOCIAL_POST_PREFLIGHT_FAILED::" + socialDeliveryIssueMessage(scheduleIssues));
  }

  return prisma.socialPost.update({
    where: { id },
    data: {
      status: "scheduled",
      scheduledAt: when,
      externalId: null,
      metadataJson: {
        ...((post.metadataJson && typeof post.metadataJson === "object" && !Array.isArray(post.metadataJson))
          ? post.metadataJson as Record<string, unknown>
          : {}),
        lastDeliveryError: null,
        rescheduledAt: new Date().toISOString(),
      } as any,
    },
  });
}

export async function cancelSocialSchedule(id: string) {
  if (!usePostgres()) {
    const post = memoryStore.socialPosts.find((item) => item.id === id);
    if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
    if (post.status !== "scheduled") throw new Error("SOCIAL_POST_NOT_SCHEDULED");
    post.status = "draft";
    post.scheduledAt = undefined;
    return post;
  }

  const prisma = getPrisma();
  const currentWorkspaceId = await workspaceId();
  const post = await prisma.socialPost.findFirst({
    where: { id, brand: { is: { workspaceId: currentWorkspaceId } } },
  });
  if (!post) throw new Error("SOCIAL_POST_NOT_FOUND");
  if (post.status !== "scheduled") throw new Error("SOCIAL_POST_NOT_SCHEDULED");

  return prisma.socialPost.update({
    where: { id },
    data: {
      status: "draft",
      scheduledAt: null,
      metadataJson: {
        ...((post.metadataJson && typeof post.metadataJson === "object" && !Array.isArray(post.metadataJson))
          ? post.metadataJson as Record<string, unknown>
          : {}),
        scheduleCancelledAt: new Date().toISOString(),
      } as any,
    },
  });
}
