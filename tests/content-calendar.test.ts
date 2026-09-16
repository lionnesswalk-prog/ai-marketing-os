import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recommendPostingTimes } from "../apps/web/lib/posting-intelligence";
import { buildContentCalendar } from "../packages/agents/src/runtime";

const recommendations = recommendPostingTimes([
  {
    platform: "instagram",
    id: "ig1",
    title: "Evening 1",
    publishedAt: "2026-09-10T19:00:00.000Z",
    likes: 50,
    comments: 10,
  },
  {
    platform: "instagram",
    id: "ig2",
    title: "Evening 2",
    publishedAt: "2026-09-11T20:00:00.000Z",
    likes: 45,
    comments: 8,
  },
  {
    platform: "instagram",
    id: "ig3",
    title: "Morning",
    publishedAt: "2026-09-12T09:00:00.000Z",
    likes: 5,
    comments: 1,
  },
], 0);

const instagram = recommendations.find((item) => item.platform === "instagram");
assert.ok(instagram);
assert.equal(instagram.evidence, "performance");
assert.equal(instagram.postingWindow, "evening");
assert.equal(instagram.sampleSize, 3);

const facebook = recommendations.find((item) => item.platform === "facebook");
assert.ok(facebook);
assert.equal(facebook.evidence, "test");
assert.equal(facebook.sampleSize, 0);
assert.ok(facebook.reason.includes("controlled testing window"));

const previousMode = process.env.AI_MODE;
const previousKey = process.env.OPENAI_API_KEY;
try {
  process.env.AI_MODE = "mock";
  delete process.env.OPENAI_API_KEY;

  const weekly = await buildContentCalendar({
    brandName: "Example Brand",
    objective: "Build discovery",
    focus: "New collection",
    horizonDays: 7,
    postCount: 4,
    brandContext: "Verified brand context",
    timingContext: "Instagram · recent performance evidence · evening",
  });
  assert.equal(weekly.mode, "mock");
  assert.equal(weekly.output.entries.length, 4);
  assert.ok(weekly.output.entries.every((entry) => entry.dayOffset >= 0 && entry.dayOffset < 7));

  const monthly = await buildContentCalendar({
    brandName: "Example Brand",
    objective: "Build awareness",
    horizonDays: 30,
    postCount: 12,
    brandContext: "Verified brand context",
    timingContext: "Test windows",
  });
  assert.equal(monthly.output.entries.length, 12);
  assert.ok(monthly.output.entries.every((entry) => entry.dayOffset >= 0 && entry.dayOffset < 30));
} finally {
  if (previousMode === undefined) delete process.env.AI_MODE;
  else process.env.AI_MODE = previousMode;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

const schema = await readFile("prisma/schema.prisma", "utf8");
assert.ok(schema.includes("model ContentCalendarPlan"));
assert.ok(schema.includes("model ContentCalendarItem"));
assert.ok(schema.includes("socialPostId    String?"));

const calendarLib = await readFile("apps/web/lib/content-calendar.ts", "utf8");
assert.ok(calendarLib.includes("sourceCalendarItemId"));
assert.ok(calendarLib.includes("recoverCalendarPost"));
assert.ok(calendarLib.includes("startScheduledSocialPostWorkflow"));

const calendarUi = await readFile("apps/web/components/ContentCalendar.tsx", "utf8");
assert.ok(calendarUi.includes("7 days · 4 posts"));
assert.ok(calendarUi.includes("30 days · 12 posts"));
assert.ok(calendarUi.includes("Performance-informed timing"));
assert.ok(calendarUi.includes("Schedule full plan"));

console.log("Content calendar tests passed");
