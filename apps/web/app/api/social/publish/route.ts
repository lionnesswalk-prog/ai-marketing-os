import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../lib/auth";
import { createSocialPosts } from "../../../../lib/repository";
import { publishFacebook, publishInstagram } from "../../../../lib/meta-integration";
import { publishLinkedIn } from "../../../../lib/linkedin-integration";

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
  scheduledAt: z.string().optional(),
  action: z.enum(["draft", "schedule", "publish"]),
});

function friendlyPublishError(error: unknown, platformName: string) {
  const message = error instanceof Error ? error.message : "Unknown publishing error";
  if (["FACEBOOK_NOT_CONNECTED", "INSTAGRAM_NOT_CONNECTED", "LINKEDIN_NOT_CONNECTED"].includes(message)) {
    return `${platformName} is not connected yet.`;
  }
  if (message === "INSTAGRAM_MEDIA_REQUIRED") return "Instagram needs a public image or video URL before it can publish.";
  if (message === "LINKEDIN_MEDIA_UPLOAD_NOT_READY") return "LinkedIn media upload is not enabled yet; the post stayed safely in the queue.";
  if (message.endsWith("FORMAT_NOT_READY")) return `${platformName} publishing for this format is still queued.`;
  if (message === "INSTAGRAM_MEDIA_STILL_PROCESSING") return "Instagram is still processing the video. The post was kept in the queue so it can be retried safely.";
  return `${platformName}: ${message}`;
}

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = publishRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the post details and selected platforms." }, { status: 400 });
  }

  const input = parsed.data;
  if (input.action === "schedule" && !input.scheduledAt) {
    return NextResponse.json({ error: "Choose a schedule date and time first." }, { status: 400 });
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

  try {
    if (input.action !== "publish") {
      const posts = await createSocialPosts({
        ...common,
        platforms: input.platforms,
        status: input.action === "schedule" ? "scheduled" : "draft",
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
    const queued: string[] = [];
    const warnings: string[] = [];

    for (const channel of input.platforms) {
      let status: "draft" | "published" = "draft";
      const label = channel === "x" ? "X" : channel.charAt(0).toUpperCase() + channel.slice(1);

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
      } else {
        queued.push(label);
      }

      const [created] = await createSocialPosts({ ...common, platforms: [channel], status });
      posts.push(created);
    }

    const message = published.length
      ? `Published to ${published.join(", ")}.${queued.length ? ` ${queued.join(", ")} stayed in the portal queue.` : ""}`
      : `Saved to the publishing queue for ${queued.join(", ")}.`;

    return NextResponse.json({
      ok: true,
      posts,
      mode: queued.length ? "partial" : "live",
      message,
      warning: warnings.length ? warnings.join(" ") : queued.length ? "Connect the remaining social APIs to publish those channels directly." : undefined,
    }, { status: queued.length ? 207 : 200 });
  } catch (error) {
    console.error("social publish failed", error);
    return NextResponse.json({ error: "Unable to save or publish this post right now." }, { status: 500 });
  }
}
