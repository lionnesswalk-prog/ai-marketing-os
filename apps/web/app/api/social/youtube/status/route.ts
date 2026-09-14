import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../../lib/auth";
import { getSocialPostById, updateSocialPostDelivery } from "../../../../../lib/repository";
import { getYouTubeVideoStatus } from "../../../../../lib/youtube-integration";
import { classifyYouTubePublishStatus } from "../../../../../lib/provider-processing-status";

const schema = z.object({ postId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot refresh provider delivery state." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Post ID is required." }, { status: 400 });

  const post = await getSocialPostById(parsed.data.postId);
  if (!post || post.platform !== "youtube") return NextResponse.json({ error: "YouTube post not found." }, { status: 404 });
  if (!post.externalId) return NextResponse.json({ error: "This YouTube post does not have a video ID yet." }, { status: 400 });

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
    console.error("youtube status refresh failed", { postId: post.id, error });
    return NextResponse.json({ error: "Unable to refresh YouTube delivery status." }, { status: 502 });
  }
}
