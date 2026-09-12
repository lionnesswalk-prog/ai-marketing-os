import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../../lib/auth";
import { getSocialPostById, updateSocialPostDelivery } from "../../../../../lib/repository";
import { getYouTubeVideoStatus } from "../../../../../lib/youtube-integration";
import { classifyYouTubePublishStatus } from "../../../../../lib/provider-processing-status";

const schema = z.object({ postId: z.string().min(1) });

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Post ID is required." }, { status: 400 });

  const post = await getSocialPostById(parsed.data.postId);
  if (!post || post.platform !== "youtube") {
    return NextResponse.json({ error: "YouTube post not found." }, { status: 404 });
  }
  if (!post.externalId) {
    return NextResponse.json({ error: "This YouTube post does not have a video ID yet." }, { status: 400 });
  }

  try {
    const provider = await getYouTubeVideoStatus(post.externalId);
    const nextStatus = classifyYouTubePublishStatus(provider);

    await updateSocialPostDelivery(post.id, nextStatus, post.externalId);

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      providerStatus: provider.uploadStatus,
      processingStatus: provider.processingStatus,
      failureReason: provider.failureReason,
      rejectionReason: provider.rejectionReason,
      privacyStatus: provider.privacyStatus,
      videoId: provider.videoId,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to refresh YouTube status.",
    }, { status: 400 });
  }
}
