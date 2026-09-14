import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../../lib/auth";
import { getSocialPostById, updateSocialPostDelivery } from "../../../../../lib/repository";
import { getTikTokPublishStatus } from "../../../../../lib/tiktok-integration";
import { classifyTikTokPublishStatus } from "../../../../../lib/provider-processing-status";

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
  if (!post || post.platform !== "tiktok") return NextResponse.json({ error: "TikTok post not found." }, { status: 404 });
  if (!post.externalId) return NextResponse.json({ error: "This TikTok post does not have a publish ID yet." }, { status: 400 });

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
    console.error("tiktok status refresh failed", { postId: post.id, error });
    return NextResponse.json({ error: "Unable to refresh TikTok delivery status." }, { status: 502 });
  }
}
