import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildContentLearningContext,
  contentEngagementScore,
  matchProviderAnalytics,
  type ContentLearningSummary,
} from "../apps/web/lib/content-learning";

const posts = [
  { id: "post-1", platform: "instagram", externalId: "ig-123", title: "Craft story" },
  { id: "post-2", platform: "pinterest", externalId: "pin-456", title: "Detail story" },
  { id: "post-3", platform: "x", externalId: "same-id", title: "X story" },
];

const analytics = [
  {
    platform: "instagram" as const,
    id: "ig-123",
    title: "Provider caption",
    likes: 20,
    comments: 3,
    publishedAt: "2026-09-17T13:00:00.000Z",
  },
  {
    platform: "pinterest" as const,
    id: "pin-456",
    title: "Pin",
    impressions: 100,
    saves: 8,
  },
  {
    platform: "instagram" as const,
    id: "same-id",
    title: "Wrong platform should not match X",
    likes: 999,
  },
  {
    platform: "instagram" as const,
    id: "different-id",
    title: "Craft story",
    likes: 999,
  },
];

const matched = matchProviderAnalytics(posts, analytics);
assert.equal(matched.length, 2);
assert.deepEqual(matched.map((item) => item.post.id).sort(), ["post-1", "post-2"]);
assert.equal(
  matched.some((item) => item.item.title === "Craft story" && item.item.id === "different-id"),
  false,
  "matching must never use fuzzy title similarity",
);

assert.equal(
  contentEngagementScore({ likes: 10, comments: 2, shares: 1, saves: 3 }),
  10 * 3 + 2 * 5 + 1 * 6 + 3 * 5,
);

const sparse: ContentLearningSummary = {
  matchedPostCount: 2,
  evidence: "insufficient",
  platformSummaries: [{
    platform: "instagram",
    sampleSize: 2,
    examples: [{
      socialPostId: "post-1",
      platform: "instagram",
      theme: "Craft story",
      headline: "Craft story",
      engagementScore: 50,
      metrics: { views: 0, impressions: 0, engagements: 0, likes: 10, comments: 2, shares: 0, saves: 0 },
    }],
  }],
  note: "Sparse",
};
const sparseContext = buildContentLearningContext(sparse);
assert.ok(sparseContext.includes("Evidence is still sparse"));
assert.ok(sparseContext.includes("observations only"));
assert.ok(sparseContext.includes("do not infer causation"));

const active: ContentLearningSummary = {
  ...sparse,
  matchedPostCount: 5,
  evidence: "learning",
  note: "Learning",
};
const activeContext = buildContentLearningContext(active);
assert.ok(activeContext.includes("5 verified portal→provider performance matches"));
assert.ok(activeContext.includes("directional evidence"));
assert.ok(activeContext.includes("Do not compare raw engagement scores across platforms"));

const schema = await readFile("prisma/schema.prisma", "utf8");
assert.ok(schema.includes("model ContentPerformanceSnapshot"));
assert.ok(schema.includes("socialPostId      String     @unique"));
assert.ok(schema.includes("performanceSnapshot ContentPerformanceSnapshot?"));

const generateRoute = await readFile("apps/web/app/api/content-calendar/generate/route.ts", "utf8");
assert.ok(generateRoute.includes("refreshContentLearning"));
assert.ok(generateRoute.includes("buildContentLearningContext"));
assert.ok(generateRoute.includes("learningContext"));

const analyticsPage = await readFile("apps/web/app/analytics/page.tsx", "utf8");
assert.ok(analyticsPage.includes("AI LEARNING LOOP"));
assert.ok(analyticsPage.includes("verified matches"));
assert.ok(analyticsPage.includes("Building history"));

console.log("Content learning tests passed");
