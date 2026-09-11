import { getPrisma } from "./prisma";
import { publishFacebook, publishInstagram } from "./meta-integration";
import { publishLinkedIn } from "./linkedin-integration";
import { publishX } from "./x-integration";
import { publishTikTok, type TikTokPrivacyLevel } from "./tiktok-integration";
import { publishYouTube, type YouTubePrivacyStatus } from "./youtube-integration";
import { publishPinterest } from "./pinterest-integration";

type JsonRecord = Record<string, unknown>;

function text(meta: JsonRecord, key: string) {
  return typeof meta[key] === "string" ? meta[key] as string : undefined;
}

function bool(meta: JsonRecord, key: string) {
  return typeof meta[key] === "boolean" ? meta[key] as boolean : undefined;
}

function metadataOf(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

async function completePost(
  id: string,
  status: "publishing" | "published" | "failed",
  externalId?: string,
  error?: string,
) {
  const prisma = getPrisma();
  const current = await prisma.socialPost.findUnique({ where: { id } });
  if (!current) return;
  const meta = metadataOf(current.metadataJson);
  await prisma.socialPost.update({
    where: { id },
    data: {
      status,
      ...(externalId ? { externalId } : {}),
      metadataJson: {
        ...meta,
        lastDeliveryAttemptAt: new Date().toISOString(),
        lastDeliveryError: error || null,
      },
    },
  });
}

async function publishClaimedPost(post: {
  id: string;
  brandId: string;
  platform: string;
  contentType: string;
  title: string;
  caption: string;
  externalId: string | null;
  metadataJson: unknown;
}) {
  const meta = metadataOf(post.metadataJson);
  const common = {
    title: post.title,
    caption: post.caption,
    contentType: post.contentType,
    mediaUrl: text(meta, "mediaUrl"),
    linkUrl: text(meta, "linkUrl"),
    hashtags: text(meta, "hashtags"),
    cta: text(meta, "cta"),
    altText: text(meta, "altText"),
  };

  try {
    if (post.platform === "facebook") {
      const result = await publishFacebook(common, post.brandId);
      await completePost(post.id, "published", ("post_id" in result ? result.post_id : undefined) || result.id);
      return "published";
    }

    if (post.platform === "instagram") {
      const result = await publishInstagram(common, post.brandId);
      await completePost(post.id, "published", result.id);
      return "published";
    }

    if (post.platform === "linkedin") {
      const result = await publishLinkedIn(common, post.brandId);
      await completePost(post.id, "published", result.id);
      return "published";
    }

    if (post.platform === "x") {
      const result = await publishX(common, post.brandId);
      await completePost(post.id, "published", result.id);
      return "published";
    }

    if (post.platform === "tiktok") {
      const privacy = text(meta, "tiktokPrivacyLevel") as TikTokPrivacyLevel | undefined;
      const result = await publishTikTok({ ...common, privacyLevel: privacy }, post.brandId);
      await completePost(post.id, "publishing", result.publishId);
      return "publishing";
    }

    if (post.platform === "youtube") {
      const privacy = (text(meta, "youtubePrivacyStatus") || "private") as YouTubePrivacyStatus;
      const result = await publishYouTube({
        ...common,
        privacyStatus: privacy,
        madeForKids: bool(meta, "youtubeMadeForKids") ?? false,
      }, post.brandId);
      const status = result.uploadStatus === "processed" ? "published" : "publishing";
      await completePost(post.id, status, result.videoId);
      return status;
    }

    if (post.platform === "pinterest") {
      const result = await publishPinterest({
        ...common,
        boardId: text(meta, "pinterestBoardId"),
      }, post.brandId);
      await completePost(post.id, "published", result.pinId);
      return "published";
    }

    throw new Error("UNSUPPORTED_SOCIAL_PLATFORM");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scheduled publishing error";
    await completePost(post.id, "failed", post.externalId || undefined, message);
    return "failed";
  }
}

export async function runScheduledPublisher(limit = 3) {
  const prisma = getPrisma();
  if (process.env.DATA_BACKEND !== "postgres") {
    return { claimed: 0, published: 0, processing: 0, failed: 0, skipped: "postgres-required" };
  }

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
    const result = await publishClaimedPost(post);
    if (result === "published") published += 1;
    else if (result === "publishing") processing += 1;
    else failed += 1;
  }

  return { claimed, published, processing, failed };
}
