import assert from "node:assert/strict";
import { getRuntimeHealthSnapshot } from "../apps/web/lib/runtime-health";

const keys = [
  "AUTH_MODE",
  "DATA_BACKEND",
  "AUTH_SECRET",
  "DATABASE_URL",
  "INTEGRATION_ENCRYPTION_KEY",
  "ALLOW_SHARED_ENV_INTEGRATIONS",
  "ALLOW_PREVIEW_AUTH_IN_PRODUCTION",
  "CRON_SECRET",
  "SCHEDULER_EXTERNAL_ENABLED",
  "GITHUB_SCHEDULER_OIDC_ENABLED",
  "AI_MODE",
  "OPENAI_API_KEY",
  "VERCEL_ENV",
] as const;
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

try {
  process.env.VERCEL_ENV = "production";
  process.env.AUTH_MODE = "database";
  process.env.DATA_BACKEND = "postgres";
  process.env.AUTH_SECRET = "secret";
  process.env.DATABASE_URL = "postgresql://example";
  process.env.INTEGRATION_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
  process.env.ALLOW_SHARED_ENV_INTEGRATIONS = "false";
  process.env.ALLOW_PREVIEW_AUTH_IN_PRODUCTION = "false";
  process.env.CRON_SECRET = "cron";
  process.env.SCHEDULER_EXTERNAL_ENABLED = "true";
  process.env.AI_MODE = "live";
  process.env.OPENAI_API_KEY = "test";

  const ready = getRuntimeHealthSnapshot();
  assert.equal(ready.checks.authSecret, true);
  assert.equal(ready.checks.databaseConfigured, true);
  assert.equal(ready.checks.tenantIsolation, true);
  assert.equal(ready.checks.productionModeSafe, true);
  assert.equal(ready.checks.schedulerAuthentication, true);
  assert.equal(ready.checks.externalSchedulerDeclared, true);
  assert.equal(ready.checks.aiRuntime, true);

  process.env.AUTH_MODE = "preview";
  process.env.DATA_BACKEND = "memory";
  const unsafeMode = getRuntimeHealthSnapshot();
  assert.equal(unsafeMode.checks.productionModeSafe, false);

  process.env.AUTH_MODE = "database";
  process.env.DATA_BACKEND = "postgres";
  delete process.env.AUTH_SECRET;
  process.env.ALLOW_SHARED_ENV_INTEGRATIONS = "true";
  delete process.env.OPENAI_API_KEY;
  delete process.env.SCHEDULER_EXTERNAL_ENABLED;
  const unsafe = getRuntimeHealthSnapshot();
  assert.equal(unsafe.checks.authSecret, false);
  assert.equal(unsafe.checks.tenantIsolation, false);
  assert.equal(unsafe.checks.externalSchedulerDeclared, false);
  assert.equal(unsafe.checks.aiRuntime, false);
} finally {
  for (const key of keys) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log("runtime health tests passed");
