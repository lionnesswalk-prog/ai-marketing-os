import assert from "node:assert/strict";
import { getPrisma } from "../apps/web/lib/prisma";
import { publishScheduledPostById } from "../apps/web/lib/scheduled-publisher";

const prisma = getPrisma();
const brand = await prisma.brand.findFirst({ orderBy: { createdAt: "asc" } });
assert.ok(brand);

const scheduledAt = new Date(Date.now() + 5 * 60_000);
const post = await prisma.socialPost.create({
  data: {
    brandId: brand.id,
    platform: "facebook",
    contentType: "static",
    title: "Durable scheduler guard test",
    caption: "This post must never reach a provider during CI.",
    status: "scheduled",
    scheduledAt,
    metadataJson: {},
  },
});

try {
  const staleWorkflow = await publishScheduledPostById(
    post.id,
    new Date(scheduledAt.getTime() + 60_000).toISOString(),
  );
  assert.equal(staleWorkflow.status, "skipped");
  assert.equal(staleWorkflow.reason, "schedule-changed");

  const futureWorkflow = await publishScheduledPostById(post.id, scheduledAt.toISOString());
  assert.equal(futureWorkflow.status, "not_due");
  assert.ok(futureWorkflow.delayMs > 0);

  await prisma.socialPost.update({
    where: { id: post.id },
    data: { status: "draft", scheduledAt: null },
  });

  const cancelledWorkflow = await publishScheduledPostById(post.id, scheduledAt.toISOString());
  assert.equal(cancelledWorkflow.status, "skipped");
  assert.equal(cancelledWorkflow.reason, "status-changed");
} finally {
  await prisma.socialPost.delete({ where: { id: post.id } }).catch(() => undefined);
}

console.log("durable scheduler database guards passed");
await prisma.$disconnect();
