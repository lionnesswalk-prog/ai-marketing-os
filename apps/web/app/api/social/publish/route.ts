import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { createSocialPosts } from "../../../../lib/repository";
import { publishFacebook, publishInstagram } from "../../../../lib/meta-integration";
import { publishLinkedIn } from "../../../../lib/linkedin-integration";
import { publishX } from "../../../../lib/x-integration";
import { publishTikTok } from "../../../../lib/tiktok-integration";
import { publishYouTube } from "../../../../lib/youtube-integration";
import { publishPinterest } from "../../../../lib/pinterest-integration";
import { assertBillingFeature, assertBillingSocialPostCapacity } from "../../../../lib/billing";
import { getSocialPlatforms } from "../../../../lib/social-platforms";
import {
  socialDeliveryIssueMessage,
  socialDeliveryIssuesByPlatform,
  type SocialDeliveryInput,
} from "../../../../lib/social-preflight";

const platform = z.enum(["instagram", "facebook", "linkedin", "x", "tiktok", "youtube", "pinterest"]);
const contentType = z.enum(["reel", "carousel", "static", "story", "video", "short"]);

const publishRequest = z.object({
  platforms: z.array(platform).min(1).max(7),
  contentType,
  title: z.string().trim().min(1).max(120),
  caption: z.string().max(5000).default(""),
  hashtags: z.string().max(1000).optional(),
  cta: z.string().max(300).optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  linkUrl: z.string().url().optional().or(z.literal("")),
  altText: z.string().max(1000).optional(),
  tiktokPrivacyLevel: z.enum(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]).optional(),
  youtubePrivacyStatus: z.enum(["public", "private", "unlisted"]).optional(),
  youtubeMadeForKids: z.boolean().optional(),
  pinterestBoardId: z.string().optional(),
  scheduledAt: z.string().optional(),
  action: z.enum(["draft", "schedule", "publish"]),
});

function friendlyPublishError(error: unknown, platformName: string) {
  const message = error instanceof Error ? error.message : "Unknown publishing error";
  if (["FACEBOOK_NOT_CONNECTED", "INSTAGRAM_NOT_CONNECTED", "LINKEDIN_NOT_CONNECTED", "X_NOT_CONNECTED", "TIKTOK_NOT_CONNECTED", "YOUTUBE_NOT_CONNECTED", "PINTEREST_NOT_CONNECTED"].includes(message)) {
    return `${platformName} is not connected yet.`;
  }
  if (message === "INSTAGRAM_MEDIA_REQUIRED") return "Instagram needs a public image or video URL before it can publish.";
  if (message === "LINKEDIN_MEDIA_UPLOAD_NOT_READY") return "LinkedIn media upload is not enabled yet; the post stayed safely in the queue.";
  if (message === "X_MEDIA_UPLOAD_NOT_READY") return "X media upload is not enabled yet; the post stayed safely in the queue.";
  if (message === "X_TEXT_REQUIRED") return "X needs post text before publishing.";
  if (message === "TIKTOK_MEDIA_REQUIRED") return "TikTok needs a public video URL before publishing.";
  if (message === "TIKTOK_PRIVACY_REQUIRED") return "Choose a TikTok privacy level before publishing.";
  if (message === "TIKTOK_PRIVACY_NOT_ALLOWED") return "The selected TikTok privacy level is not currently allowed for this creator.";
  if (message === "YOUTUBE_MEDIA_REQUIRED") return "YouTube needs a public video URL before publishing.";
  if (message === "YOUTUBE_PRIVACY_REQUIRED") return "Choose a YouTube privacy setting before publishing.";
  if (message === "YOUTUBE_MEDIA_NOT_VIDEO") return "The YouTube media URL must point to a video file.";
  if (message === "YOUTUBE_MEDIA_TOO_LARGE_FOR_SERVER_TRANSFER") return "This YouTube video is too large for the current server-transfer limit and stayed in the queue.";
  if (message === "PINTEREST_BOARD_REQUIRED") return "Choose a Pinterest board before publishing.";
  if (message === "PINTEREST_MEDIA_REQUIRED") return "Pinterest needs a public image URL before publishing.";
  if (message === "PINTEREST_VIDEO_UPLOAD_NOT_READY") return "Pinterest video Pin upload is not enabled yet; the post stayed safely in the queue.";
  if (message.includes("url_ownership_unverified")) return "TikTok requires the media URL domain or URL prefix to be verified in the TikTok developer app.";
  if (message.includes("unaudited_client")) return "TikTok app audit is required for broader public posting; unaudited clients are restricted.";
  if (message.endsWith("FORMAT_NOT_READY")) return `${platformName} publishing for this format is still queued.`;
  if (message === "INSTAGRAM_MEDIA_STILL_PROCESSING") return "Instagram is still processing the video. The post was kept in the queue so it can be retried safely.";
  return `${platformName}: ${message}`;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) return NextResponse.json({ error: "Your role cannot publish or schedule social content." }, { status: 403 });

  const parsed = publishRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the post details and selected platforms." }, { status: 400 });
  }

  const input = parsed.data;
  if (input.action === "schedule" && !input.scheduledAt) {
    return NextResponse.json({ error: "Choose a schedule date and time first." }, { status: 400 });
  }
  if (input.action === "schedule" && input.scheduledAt) {
    const scheduledAt = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choose a future schedule date and time." }, { status: 400 });
    }
  }

  try {
    await assertBillingFeature(session.workspaceId, "socialPublishing");
    await assertBillingSocialPostCapacity(session.workspaceId, input.platforms.length);
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({
        error: "Social publishing is not included in the current plan.",
      }, { status: 403 });
    }
    if (error instanceof Error && error.message === "BILLING_SOCIAL_POST_LIMIT") {
      return NextResponse.json({
        error: "This workspace has reached its monthly social-post plan limit. Upgrade the plan before creating more posts.",
      }, { status: 402 });
    }
    throw error;
  }

  const common = {
    contentType: input.contentType,
    title: input.title,
    caption: input.caption,
    scheduledAt: input.action === "schedule" ? input.scheduledAt : undefined,
    mediaUrl: input.mediaUrl || undefined,
    linkUrl: input.linkUrl || undefined,
    hashtags: input.hashtags || undefined,
    cta: input.cta || undefined,
    altText: input.altText || undefined,
  };

  const deliveryInputs: SocialDeliveryInput[] = input.platforms.map((channel) => ({
    platform: channel,
    contentType: input.contentType,
    caption: input.caption,
    hashtags: input.hashtags,
    cta: input.cta,
    mediaUrl: input.mediaUrl || undefined,
    linkUrl: input.linkUrl || undefined,
    tiktokPrivacyLevel: input.tiktokPrivacyLevel,
    youtubePrivacyStatus: input.youtubePrivacyStatus,
    pinterestBoardId: input.pinterestBoardId,
  }));
  const preflightByPlatform = socialDeliveryIssuesByPlatform(deliveryInputs);
  const platformStates = input.action === "draft" ? [] : await getSocialPlatforms();
  const platformStateById = new Map(platformStates.map((item) => [item.id, item]));

  if (input.action === "schedule") {
    const issues = input.platforms.flatMap((channel) => preflightByPlatform.get(channel) || []);
    const unavailable = input.platforms
      .map((channel) => platformStateById.get(channel))
      .filter((item) => !item?.connected || item.connectionCheckFailed);

    if (issues.length) {
      return NextResponse.json({
        error: socialDeliveryIssueMessage(issues),
        issues,
      }, { status: 400 });
    }
    if (unavailable.length) {
      const labels = unavailable.map((item) => item?.name || "Selected channel");
      return NextResponse.json({
        error: "Connect and verify " + labels.join(", ") + " before scheduling. Draft mode remains available.",
      }, { status: 409 });
    }
  }

  try {
    if (input.action !== "publish") {
      const posts = await createSocialPosts({
        ...common,
        platforms: input.platforms,
        status: input.action === "schedule" ? "scheduled" : "draft",
        tiktokPrivacyLevel: input.tiktokPrivacyLevel,
        youtubePrivacyStatus: input.youtubePrivacyStatus,
        youtubeMadeForKids: input.youtubeMadeForKids,
        pinterestBoardId: input.pinterestBoardId,
      });
      return NextResponse.json({
        ok: true,
        posts,
        mode: "queue",
        message: input.action === "schedule" ? "Post scheduled in the portal queue." : "Draft saved for the selected channels.",
      });
    }

    const posts = [];
    const published: string[] = [];
    const processing: string[] = [];
    const queued: string[] = [];
    const warnings: string[] = [];

    for (const channel of input.platforms) {
      let status: "draft" | "publishing" | "published" = "draft";
      let externalId: string | undefined;
      const label = channel === "x" ? "X" : channel.charAt(0).toUpperCase() + channel.slice(1);
      const structuralIssues = preflightByPlatform.get(channel) || [];
      const platformState = platformStateById.get(channel);

      if (structuralIssues.length || !platformState?.connected || platformState.connectionCheckFailed) {
        queued.push(label);
        if (structuralIssues.length) warnings.push(socialDeliveryIssueMessage(structuralIssues));
        else if (platformState?.connectionCheckFailed) warnings.push(label + " connection health could not be verified, so the post stayed safely in the queue.");
        else warnings.push(label + " is not connected yet.");

        const [created] = await createSocialPosts({
          ...common,
          platforms: [channel],
          status: "draft",
          tiktokPrivacyLevel: input.tiktokPrivacyLevel,
          youtubePrivacyStatus: input.youtubePrivacyStatus,
          youtubeMadeForKids: input.youtubeMadeForKids,
          pinterestBoardId: input.pinterestBoardId,
        });
        posts.push(created);
        continue;
      }

      if (channel === "facebook") {
        try {
          await publishFacebook(common);
          status = "published";
          published.push("Facebook");
        } catch (error) {
          queued.push("Facebook");
          warnings.push(friendlyPublishError(error, "Facebook"));
        }
      } else if (channel === "instagram") {
        try {
          await publishInstagram(common);
          status = "published";
          published.push("Instagram");
        } catch (error) {
          queued.push("Instagram");
          warnings.push(friendlyPublishError(error, "Instagram"));
        }
      } else if (channel === "linkedin") {
        try {
          await publishLinkedIn(common);
          status = "published";
          published.push("LinkedIn");
        } catch (error) {
          queued.push("LinkedIn");
          warnings.push(friendlyPublishError(error, "LinkedIn"));
        }
      } else if (channel === "x") {
        try {
          await publishX(common);
          status = "published";
          published.push("X");
        } catch (error) {
          queued.push("X");
          warnings.push(friendlyPublishError(error, "X"));
        }
      } else if (channel === "tiktok") {
        try {
          const result = await publishTikTok({ ...common, privacyLevel: input.tiktokPrivacyLevel });
          externalId = result.publishId;
          status = "publishing";
          processing.push("TikTok");
        } catch (error) {
          queued.push("TikTok");
          warnings.push(friendlyPublishError(error, "TikTok"));
        }
      } else if (channel === "youtube") {
        try {
          const result = await publishYouTube({
            ...common,
            privacyStatus: input.youtubePrivacyStatus || "private",
            madeForKids: Boolean(input.youtubeMadeForKids),
          });
          externalId = result.videoId;
          status = result.uploadStatus === "processed" ? "published" : "publishing";
          if (status === "published") published.push("YouTube");
          else processing.push("YouTube");
        } catch (error) {
          queued.push("YouTube");
          warnings.push(friendlyPublishError(error, "YouTube"));
        }
      } else if (channel === "pinterest") {
        try {
          const result = await publishPinterest({ ...common, boardId: input.pinterestBoardId });
          externalId = result.pinId;
          status = "published";
          published.push("Pinterest");
        } catch (error) {
          queued.push("Pinterest");
          warnings.push(friendlyPublishError(error, "Pinterest"));
        }
      } else {
        queued.push(label);
      }

      const [created] = await createSocialPosts({ ...common, platforms: [channel], status, externalId, tiktokPrivacyLevel: input.tiktokPrivacyLevel, youtubePrivacyStatus: input.youtubePrivacyStatus, youtubeMadeForKids: input.youtubeMadeForKids, pinterestBoardId: input.pinterestBoardId });
      posts.push(created);
    }

    const messageParts: string[] = [];
    if (published.length) messageParts.push(`Published to ${published.join(", ")}.`);
    if (processing.length) messageParts.push(`${processing.join(", ")} submitted and is processing.`);
    if (queued.length) messageParts.push(`${queued.join(", ")} stayed in the portal queue.`);
    const message = messageParts.join(" ") || "Post saved.";

    return NextResponse.json({
      ok: true,
      posts,
      mode: queued.length ? "partial" : processing.length ? "processing" : "live",
      message,
      warning: warnings.length ? warnings.join(" ") : queued.length ? "Connect the remaining social APIs to publish those channels directly." : undefined,
    }, { status: queued.length ? 207 : processing.length ? 202 : 200 });
  } catch (error) {
    console.error("social publish failed", error);
    return NextResponse.json({ error: "Unable to save or publish this post right now." }, { status: 500 });
  }
}
