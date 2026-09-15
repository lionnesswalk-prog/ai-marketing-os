import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../../lib/auth";
import {
  cancelSocialSchedule,
  publishDraftSocialPostNow,
  rescheduleSocialPost,
  retrySocialPostNow,
} from "../../../../../lib/social-post-actions";
import { startScheduledSocialPostWorkflow } from "../../../../../lib/social-workflow";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), postId: z.string().min(1) }),
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
  if (message === "SOCIAL_POST_NOT_DRAFT") return { status: 409, text: "Only draft posts can be published immediately." };
  if (message === "SOCIAL_POST_PUBLISH_CONFLICT") return { status: 409, text: "This draft is already being published." };
  if (message === "SOCIAL_POST_NOT_SCHEDULED") return { status: 409, text: "This post is no longer scheduled." };
  if (message === "SOCIAL_POST_NOT_RESCHEDULABLE") return { status: 409, text: "This post cannot be rescheduled in its current state." };
  if (message === "SOCIAL_POST_SCHEDULE_INVALID") return { status: 400, text: "Choose a future date and time." };
  if (message === "SOCIAL_POST_RETRY_CONFLICT") return { status: 409, text: "This post is already being retried." };
  if (message.startsWith("SOCIAL_POST_PREFLIGHT_FAILED::")) {
    return { status: 400, text: message.slice("SOCIAL_POST_PREFLIGHT_FAILED::".length) || "Fix the post delivery requirements before retrying." };
  }
  return { status: 400, text: "Unable to complete this post action." };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) return NextResponse.json({ error: "Your role cannot modify the publishing queue." }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid post action." }, { status: 400 });

  try {
    if (parsed.data.action === "publish") {
      const result = await publishDraftSocialPostNow(parsed.data.postId);
      return NextResponse.json({
        ok: true,
        status: result.status,
        message: result.preview
          ? "Preview mode kept the draft in the portal queue."
          : result.status === "failed"
            ? "The provider rejected the post. It is available to review and retry."
            : result.status === "publishing"
              ? "Post submitted. The provider is processing it."
              : "Post published successfully.",
      }, { status: result.status === "failed" ? 207 : result.status === "publishing" ? 202 : 200 });
    }

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
      try {
        await startScheduledSocialPostWorkflow(parsed.data.postId, parsed.data.scheduledAt);
        return NextResponse.json({ ok: true, message: "Post rescheduled with durable exact-time delivery." });
      } catch (error) {
        console.error("durable reschedule activation failed", { postId: parsed.data.postId, error });
        return NextResponse.json({
          ok: true,
          message: "Post rescheduled successfully.",
          warning: "Durable delivery could not be armed, so the daily recovery scheduler remains the fallback.",
        });
      }
    }

    await cancelSocialSchedule(parsed.data.postId);
    return NextResponse.json({ ok: true, message: "Schedule cancelled. The post is back in drafts." });
  } catch (error) {
    const response = friendlyError(error);
    if (response.text === "Unable to complete this post action.") console.error("social post action failed", error);
    return NextResponse.json({ error: response.text }, { status: response.status });
  }
}
