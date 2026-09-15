import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isPostgresBackend } from "../apps/web/lib/runtime-mode";

const previousEnv = process.env.VERCEL_ENV;
const previousBackend = process.env.DATA_BACKEND;

try {
  process.env.VERCEL_ENV = "production";
  delete process.env.DATA_BACKEND;
  assert.equal(isPostgresBackend(), true, "production provider storage must default to Postgres");

  const providerModules = [
    "apps/web/lib/meta-integration.ts",
    "apps/web/lib/linkedin-integration.ts",
    "apps/web/lib/x-integration.ts",
    "apps/web/lib/tiktok-integration.ts",
    "apps/web/lib/youtube-integration.ts",
    "apps/web/lib/pinterest-integration.ts",
  ];

  for (const path of providerModules) {
    const source = await readFile(path, "utf8");
    assert.equal(
      source.includes('process.env.DATA_BACKEND === "postgres"') ||
        source.includes('process.env.DATA_BACKEND !== "postgres"'),
      false,
      path + " must use the shared runtime-mode resolver",
    );
    assert.equal(
      source.includes('isPostgresBackend'),
      true,
      path + " must use isPostgresBackend()",
    );
  }
} finally {
  if (previousEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousEnv;
  if (previousBackend === undefined) delete process.env.DATA_BACKEND;
  else process.env.DATA_BACKEND = previousBackend;
}

console.log("provider runtime consistency tests passed");
