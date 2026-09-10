import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../lib/auth";
import { createSocialPosts } from "../../../../lib/repository";
import { getSocialPlatforms } from "../../../../lib/social-platforms";

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

  const platformState = getSocialPlatforms();
  const disconnected = input.platforms.filter((id) => !platformState.find((item) => item.id === id)?.connected);
  const canPublishLive = input.action === "publish" && disconnected.length === 0 && process.env.SOCIAL_LIVE_PUBLISHING === "true";

  const status = input.action === "schedule" ? "scheduled" : canPublishLive ? "published" : "draft";

  try {
    const posts = await createSocialPosts({
      platforms: input.platforms,
      contentType: input.contentType,
      title: input.title,
      caption: input.caption,
      status,
      scheduledAt: input.action === "schedule" ? input.scheduledAt : undefined,
      mediaUrl: input.mediaUrl || undefined,
      linkUrl: input.linkUrl || undefined,
      hashtags: input.hashtags || undefined,
      cta: input.cta || undefined,
      altText: input.altText || undefined,
    });

    if (input.action === "publish" && !canPublishLive) {
      return NextResponse.json({
        ok: true,
        posts,
        mode: "queue",
        message: disconnected.length
          ? `Saved to the publishing queue. Connect ${disconnected.join(", ")} to publish live from this portal.`
          : "Saved to the publishing queue. Enable the live publishing adapters after account authorization.",
      }, { status: 202 });
    }

    return NextResponse.json({
      ok: true,
      posts,
      mode: canPublishLive ? "live" : "queue",
      message: input.action === "schedule" ? "Post scheduled for the selected channels." : input.action === "draft" ? "Draft saved for the selected channels." : "Published to the selected channels.",
    });
  } catch (error) {
    console.error("social publish failed", error);
    return NextResponse.json({ error: "Unable to save this post right now." }, { status: 500 });
  }
}
