import { sleep } from "workflow";
import { publishScheduledPostById } from "../lib/scheduled-publisher";

async function publishScheduledPostStep(postId: string, expectedScheduledAt: string) {
  "use step";
  return publishScheduledPostById(postId, expectedScheduledAt);
}

export async function scheduledSocialPostWorkflow(
  postId: string,
  expectedScheduledAt: string,
  initialDelayMs: number,
) {
  "use workflow";

  if (initialDelayMs > 0) {
    await sleep(`${Math.max(1, Math.ceil(initialDelayMs))}ms`);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await publishScheduledPostStep(postId, expectedScheduledAt);
    if (result.status !== "not_due") return result;

    const delayMs = Math.max(1, Math.ceil(result.delayMs));
    await sleep(`${delayMs}ms`);
  }

  return { status: "skipped" as const, reason: "still-not-due-after-recheck" };
}
