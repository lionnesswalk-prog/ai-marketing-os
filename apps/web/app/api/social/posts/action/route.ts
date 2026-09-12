import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../../lib/auth";
import {
  cancelSocialSchedule,
  rescheduleSocialPost,
  retrySocialPostNow,
} from "../../../../../lib/social-post-actions";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retry"), postId: z.string().min(1) }),
  z.object({ action: z.literal("cancel"), postId: z.string().min(1) }),
  z.object({
    action: z.literal("reschedule"),
    postId: z.string().min(1),
    scheduledAt: z.string().min(1),
  }),
]);

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "SOCIAL_POST_NOT_FOUND") return { status: 404, text: "Post not found." };
  if (message === "SOCIAL_POST_NOT_FAILED") return { status: 409, text: "Only failed posts can be retried." };
  if (message === "SOCIAL_POST_NOT_SCHEDULED") return { status: 409, text: "This post is no longer scheduled." };
  if (message === "SOCIAL_POST_NOT_RESCHEDULABLE") return { status: 409, text: "This post cannot be rescheduled in its current state." };
  if (message === "SOCIAL_POST_SCHEDULE_INVALID") return { status: 400, text: "Choose a future date and time." };
  if (message === "SOCIAL_POST_RETRY_CONFLICT") return { status: 409, text: "This post is already being retried." };
  if (message.startsWith("SOCIAL_POST_PREFLIGHT_FAILED::")) {
    return { status: 400, text: message.slice("SOCIAL_POST_PREFLIGHT_FAILED::".length) || "Fix the post delivery requirements before retrying." };
  }
  return { status: 400, text: message };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) return NextResponse.json({ error: "Your role cannot modify the publishing queue." }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid post action." }, { status: 400 });

  try {
    if (parsed.data.action === "retry") {
      const result = await retrySocialPostNow(parsed.data.postId);
      return NextResponse.json({
        ok: true,
        status: result.status,
        message: result.preview
          ? "Preview mode kept the post in the portal queue."
          : result.status === "failed"
            ? "Retry completed but the provider rejected the post again."
            : result.status === "publishing"
              ? "Retry submitted. The provider is processing the post."
              : "Post published successfully.",
      }, { status: result.status === "failed" ? 207 : 200 });
    }

    if (parsed.data.action === "reschedule") {
      await rescheduleSocialPost(parsed.data.postId, parsed.data.scheduledAt);
      return NextResponse.json({ ok: true, message: "Post rescheduled successfully." });
    }

    await cancelSocialSchedule(parsed.data.postId);
    return NextResponse.json({ ok: true, message: "Schedule cancelled. The post is back in drafts." });
  } catch (error) {
    const response = friendlyError(error);
    return NextResponse.json({ error: response.text }, { status: response.status });
  }
}
