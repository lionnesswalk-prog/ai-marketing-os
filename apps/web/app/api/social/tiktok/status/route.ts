import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../../lib/auth";
import { getSocialPostById, updateSocialPostDelivery } from "../../../../../lib/repository";
import { getTikTokPublishStatus } from "../../../../../lib/tiktok-integration";
import { classifyTikTokPublishStatus } from "../../../../../lib/provider-processing-status";

const schema = z.object({ postId: z.string().min(1) });

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Post ID is required." }, { status: 400 });

  const post = await getSocialPostById(parsed.data.postId);
  if (!post || post.platform !== "tiktok") {
    return NextResponse.json({ error: "TikTok post not found." }, { status: 404 });
  }
  if (!post.externalId) {
    return NextResponse.json({ error: "This TikTok post does not have a publish ID yet." }, { status: 400 });
  }

  try {
    const provider = await getTikTokPublishStatus(post.externalId);
    const nextStatus = classifyTikTokPublishStatus(provider.status);

    await updateSocialPostDelivery(post.id, nextStatus, post.externalId);

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      providerStatus: provider.status,
      failReason: provider.failReason,
      publicPostIds: provider.publiclyAvailablePostIds,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to refresh TikTok status.",
    }, { status: 400 });
  }
}
