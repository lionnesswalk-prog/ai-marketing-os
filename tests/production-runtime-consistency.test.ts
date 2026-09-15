import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isPostgresBackend } from "../apps/web/lib/runtime-mode";

const previousEnv = process.env.VERCEL_ENV;
const previousBackend = process.env.DATA_BACKEND;

try {
  process.env.VERCEL_ENV = "production";
  delete process.env.DATA_BACKEND;
  assert.equal(isPostgresBackend(), true, "production must default to Postgres");

  const persistentModules = [
    "apps/web/lib/social-post-actions.ts",
    "apps/web/lib/social-workflow.ts",
    "apps/web/lib/scheduled-publisher.ts",
  ];

  for (const path of persistentModules) {
    const source = await readFile(path, "utf8");
    assert.equal(
      source.includes('process.env.DATA_BACKEND === "postgres"') ||
        source.includes('process.env.DATA_BACKEND !== "postgres"'),
      false,
      path + " must use the shared runtime-mode resolver",
    );
  }
} finally {
  if (previousEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousEnv;
  if (previousBackend === undefined) delete process.env.DATA_BACKEND;
  else process.env.DATA_BACKEND = previousBackend;
}

console.log("production runtime consistency tests passed");
