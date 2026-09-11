import { getPrisma } from "./prisma";

type DeliveryStatus = "publishing" | "published" | "failed";

function meta(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

async function finish(
  postId: string,
  status: DeliveryStatus,
  externalId?: string,
  error?: string,
) {
  const prisma = getPrisma();
  const current = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!current) return;

  const metadata = meta(current.metadataJson);
  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status,
      ...(externalId ? { externalId } : {}),
      metadataJson: {
        ...metadata,
        lastDeliveryAttemptAt: new Date().toISOString(),
        lastDeliveryError: error || null,
      } as any,
    },
  });
}

export async function deliverSocialPost(post: any): Promise<DeliveryStatus> {
  const metadata = meta(post.metadataJson);
  const common: any = {
    title: post.title,
    caption: post.caption,
    contentType: post.contentType,
    mediaUrl: metadata.mediaUrl || undefined,
    linkUrl: metadata.linkUrl || undefined,
    hashtags: metadata.hashtags || undefined,
    cta: metadata.cta || undefined,
    altText: metadata.altText || undefined,
  };

  try {
    if (post.platform === "facebook") {
      const { publishFacebook } = await import("./meta-integration");
      const result: any = await publishFacebook(common, post.brandId);
      await finish(post.id, "published", result?.post_id || result?.id);
      return "published";
    }

    if (post.platform === "instagram") {
      const { publishInstagram } = await import("./meta-integration");
      const result: any = await publishInstagram(common, post.brandId);
      await finish(post.id, "published", result?.id);
      return "published";
    }

    if (post.platform === "linkedin") {
      const { publishLinkedIn } = await import("./linkedin-integration");
      const result: any = await publishLinkedIn(common, post.brandId);
      await finish(post.id, "published", result?.id);
      return "published";
    }

    if (post.platform === "x") {
      const { publishX } = await import("./x-integration");
      const result: any = await publishX(common, post.brandId);
      await finish(post.id, "published", result?.id);
      return "published";
    }

    if (post.platform === "tiktok") {
      const { publishTikTok } = await import("./tiktok-integration");
      const result: any = await publishTikTok({
        ...common,
        privacyLevel: metadata.tiktokPrivacyLevel || undefined,
      }, post.brandId);
      await finish(post.id, "publishing", result?.publishId);
      return "publishing";
    }

    if (post.platform === "youtube") {
      const { publishYouTube } = await import("./youtube-integration");
      const result: any = await publishYouTube({
        ...common,
        privacyStatus: metadata.youtubePrivacyStatus || "private",
        madeForKids: Boolean(metadata.youtubeMadeForKids),
      }, post.brandId);
      const status: DeliveryStatus = result?.uploadStatus === "processed" ? "published" : "publishing";
      await finish(post.id, status, result?.videoId);
      return status;
    }

    if (post.platform === "pinterest") {
      const { publishPinterest } = await import("./pinterest-integration");
      const result: any = await publishPinterest({
        ...common,
        boardId: metadata.pinterestBoardId || undefined,
      }, post.brandId);
      await finish(post.id, "published", result?.pinId);
      return "published";
    }

    throw new Error("UNSUPPORTED_SOCIAL_PLATFORM");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scheduled publishing error";
    await finish(post.id, "failed", post.externalId || undefined, message);
    return "failed";
  }
}

export async function runScheduledPublisher(limit = 3) {
  if (process.env.DATA_BACKEND !== "postgres") {
    return { claimed: 0, published: 0, processing: 0, failed: 0, skipped: "postgres-required" };
  }

  const prisma = getPrisma();
  const due = await prisma.socialPost.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: Math.max(1, Math.min(limit, 10)),
  });

  let claimed = 0;
  let published = 0;
  let processing = 0;
  let failed = 0;

  for (const post of due) {
    const claim = await prisma.socialPost.updateMany({
      where: { id: post.id, status: "scheduled" },
      data: { status: "publishing" },
    });
    if (claim.count !== 1) continue;

    claimed += 1;
    const status = await deliverSocialPost(post);
    if (status === "published") published += 1;
    else if (status === "publishing") processing += 1;
    else failed += 1;
  }

  return { claimed, published, processing, failed };
}
