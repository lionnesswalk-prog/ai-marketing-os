import { NextResponse } from "next/server";
import { canManageMarketing, getSession } from "../../../../../lib/auth";
import { assertBillingFeature } from "../../../../../lib/billing";
import { recordAuditEvent } from "../../../../../lib/audit";
import { runScheduledPublisher } from "../../../../../lib/scheduled-publisher";

export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot run publishing operations." }, { status: 403 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "socialPublishing");
    const result = await runScheduledPublisher(5, { workspaceId: session.workspaceId });
    await recordAuditEvent({
      workspaceId: session.workspaceId,
      actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
      actorId: session.userId,
      action: "scheduler_manual_run",
      entityType: "SocialPublishingQueue",
      payload: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "Social publishing is not included in the current plan." }, { status: 403 });
    }
    console.error("manual workspace scheduler failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to run the workspace scheduler.",
    }, { status: 500 });
  }
}
