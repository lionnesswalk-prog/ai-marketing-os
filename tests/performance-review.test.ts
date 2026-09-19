import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { weeklyReviewPeriodKey } from "../apps/web/lib/performance-review";
import { buildWeeklyPerformanceReview } from "../packages/agents/src/runtime";

assert.equal(
  weeklyReviewPeriodKey(new Date("2026-09-18T06:00:00.000Z")),
  "2026-09-14",
  "Friday must map to the UTC Monday period key",
);
assert.equal(
  weeklyReviewPeriodKey(new Date("2026-09-21T00:00:00.000Z")),
  "2026-09-21",
  "Monday starts a new idempotent weekly review period",
);

const previousMode = process.env.AI_MODE;
const previousKey = process.env.OPENAI_API_KEY;
try {
  process.env.AI_MODE = "mock";
  delete process.env.OPENAI_API_KEY;

  const sparse = await buildWeeklyPerformanceReview({
    brandName: "Example Brand",
    evidenceStatus: "insufficient",
    matchedPostCount: 1,
    evidenceContext: "One verified matched post.",
  });
  assert.equal(sparse.mode, "mock");
  assert.equal(sparse.output.evidenceStatus, "insufficient");
  assert.ok(sparse.output.weakSignals.some((item) => item.title.includes("Sample size")));
  assert.ok(sparse.output.experiments.length >= 1);

  const active = await buildWeeklyPerformanceReview({
    brandName: "Example Brand",
    evidenceStatus: "learning",
    matchedPostCount: 8,
    evidenceContext: "Same-platform recent and previous cohorts with verified provider matches.",
  });
  assert.equal(active.output.evidenceStatus, "learning");
  assert.ok(active.output.executiveSummary.includes("directional evidence"));
} finally {
  if (previousMode === undefined) delete process.env.AI_MODE;
  else process.env.AI_MODE = previousMode;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

const schema = await readFile("prisma/schema.prisma", "utf8");
assert.ok(schema.includes("model WeeklyPerformanceReview"));
assert.ok(schema.includes("@@unique([brandId, periodKey])"));
assert.ok(schema.includes("performanceReviews WeeklyPerformanceReview[]"));
assert.ok(schema.includes("sourceReviewId String?"));
assert.ok(schema.includes("@unique"));

const engine = await readFile("apps/web/lib/performance-review.ts", "utf8");
assert.ok(engine.includes("recent7DirectionalIndexAvg"));
assert.ok(engine.includes("previous7DirectionalIndexAvg"));
assert.ok(engine.includes("recent30DirectionalIndexAvg"));
assert.ok(engine.includes("previous30DirectionalIndexAvg"));
assert.ok(engine.includes("current.count < 2"));
assert.ok(engine.includes("Only portal-published posts with exact provider content-ID matches are included."));
assert.ok(engine.includes("refreshContentLearningForBrand"));
assert.ok(engine.includes("performanceReviews: { none: { periodKey } }"));

const schedulerRoute = await readFile("apps/web/app/api/scheduler/weekly-performance-review/route.ts", "utf8");
assert.ok(schedulerRoute.includes("matchesSchedulerSharedSecret"));
assert.ok(schedulerRoute.includes("verifyGitHubSchedulerOidcToken"));
assert.ok(schedulerRoute.includes("runDueWeeklyPerformanceReviews"));

const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
assert.ok(vercel.crons.some((item: { path: string; schedule: string }) =>
  item.path === "/api/scheduler/weekly-performance-review" && item.schedule === "20 2 * * *"
));

const socialAnalytics = await readFile("apps/web/lib/social-analytics.ts", "utf8");
assert.ok(socialAnalytics.includes("getSocialAnalytics(brandId?: string)"));
assert.ok(socialAnalytics.includes("fetchMetaAnalytics(brandId)"));
assert.ok(socialAnalytics.includes("fetchPinterestAnalytics(brandId)"));

const analyticsPage = await readFile("apps/web/app/analytics/page.tsx", "utf8");
assert.ok(analyticsPage.includes("PerformanceReviewCard"));
assert.ok(analyticsPage.includes("getLatestWeeklyPerformanceReview"));

const reviewUi = await readFile("apps/web/components/PerformanceReviewCard.tsx", "utf8");
assert.ok(reviewUi.includes("OBSERVED IMPROVEMENTS"));
assert.ok(reviewUi.includes("WEAK / UNCERTAIN SIGNALS"));
assert.ok(reviewUi.includes("NEXT-WEEK EXPERIMENTS"));
assert.ok(reviewUi.includes("NEXT-WEEK PRIORITIES"));
assert.ok(reviewUi.includes("Build next week plan"));
assert.ok(reviewUi.includes("/api/performance-review/next-week-plan"));

const reviewPlanRoute = await readFile("apps/web/app/api/performance-review/next-week-plan/route.ts", "utf8");
assert.ok(reviewPlanRoute.includes("getContentCalendarPlanBySourceReview"));
assert.ok(reviewPlanRoute.includes('brand: { is: { workspaceId: session.workspaceId } }'));
assert.ok(reviewPlanRoute.includes("sourceReviewId: review.id"));
assert.ok(reviewPlanRoute.includes("review-next-week-plan"));

const generator = await readFile("apps/web/lib/content-calendar-generator.ts", "utf8");
assert.ok(generator.includes("sourceReviewId"));
assert.ok(generator.includes("getContentCalendarPlanBySourceReview"));
assert.ok(generator.includes("generateContentCalendarForSession"));

const calendarUi = await readFile("apps/web/components/ContentCalendar.tsx", "utf8");
assert.ok(calendarUi.includes('id="content-calendar"'));

console.log("Performance review tests passed");
