import { start } from "workflow/api";
import { getPrisma } from "./prisma";
import { scheduledSocialPostWorkflow } from "../workflows/scheduled-social-post";
import { isPostgresBackend } from "./runtime-mode";

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function startScheduledSocialPostWorkflow(postId: string, scheduledAt: string) {
  const when = new Date(scheduledAt);
  if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) {
    throw new Error("SOCIAL_WORKFLOW_SCHEDULE_INVALID");
  }

  if (!isPostgresBackend()) {
    return { preview: true as const };
  }

  const normalizedScheduledAt = when.toISOString();
  const delayMs = Math.max(0, when.getTime() - Date.now());
  const run = await start(
    scheduledSocialPostWorkflow,
    [postId, normalizedScheduledAt, delayMs],
  );

  try {
    const prisma = getPrisma();
    const current = await prisma.socialPost.findUnique({
      where: { id: postId },
      select: { metadataJson: true },
    });
    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        metadataJson: {
          ...metadata(current?.metadataJson),
          workflowRunId: run.runId,
          workflowScheduledAt: normalizedScheduledAt,
          workflowStartedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("scheduled workflow metadata update failed", { postId, error });
  }

  return { preview: false as const, runId: run.runId };
}
