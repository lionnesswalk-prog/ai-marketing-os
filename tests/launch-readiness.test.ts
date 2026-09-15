import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const expectedOrigin = "https://ai-marketing-os-ashy.vercel.app";
const obsoleteOrigin = "https://ai-marketing-os.vercel.app";

const smoke = await readFile(".github/workflows/production-smoke.yml", "utf8");
const schedulerWorkflow = await readFile(".github/workflows/social-scheduler.yml", "utf8");
const schedulerRoute = await readFile("apps/web/app/api/scheduler/publish-social/route.ts", "utf8");
const envExample = await readFile(".env.example", "utf8");

assert.ok(smoke.includes(expectedOrigin), "production smoke must target the canonical production app");
assert.ok(schedulerWorkflow.includes(expectedOrigin), "scheduler diagnostic must target the canonical production app");
assert.equal(smoke.includes(obsoleteOrigin), false, "production smoke must not fall back to the obsolete app domain");
assert.equal(schedulerWorkflow.includes(obsoleteOrigin), false, "scheduler diagnostic must not fall back to the obsolete app domain");
assert.ok(smoke.includes('workflow_run:'), "production smoke should run automatically after CI");
assert.ok(smoke.includes('workflows: ["CI Build"]'), "production smoke should follow CI Build");
assert.equal(
  schedulerRoute.includes('process.env.DATA_BACKEND === "postgres"') ||
    schedulerRoute.includes('process.env.DATA_BACKEND !== "postgres"'),
  false,
  "scheduler endpoint must use the shared runtime-mode resolver",
);
assert.ok(schedulerRoute.includes("isPostgresBackend"), "scheduler endpoint must use isPostgresBackend()");
assert.ok(
  envExample.includes("# SIGNUP_MODE=open lets each new client create an isolated workspace."),
  ".env.example launch guidance must be a comment",
);

console.log("launch readiness tests passed");
