import assert from "node:assert/strict";
import {
  schedulerAuthReady,
  schedulerBatchSize,
  schedulerCadenceLabel,
  schedulerExternalEnabled,
  schedulerOidcReady,
  schedulerSharedSecretReady,
} from "../apps/web/lib/scheduler-config";

const previous = {
  batch: process.env.SCHEDULER_BATCH_SIZE,
  external: process.env.SCHEDULER_EXTERNAL_ENABLED,
  oidc: process.env.GITHUB_SCHEDULER_OIDC_ENABLED,
  secret: process.env.CRON_SECRET,
};

try {
  delete process.env.SCHEDULER_BATCH_SIZE;
  assert.equal(schedulerBatchSize(), 5);
  process.env.SCHEDULER_BATCH_SIZE = "50";
  assert.equal(schedulerBatchSize(), 20);
  process.env.SCHEDULER_BATCH_SIZE = "0";
  assert.equal(schedulerBatchSize(), 1);
  process.env.SCHEDULER_BATCH_SIZE = "invalid";
  assert.equal(schedulerBatchSize(), 5);

  delete process.env.SCHEDULER_EXTERNAL_ENABLED;
  assert.equal(schedulerExternalEnabled(), false);
  process.env.SCHEDULER_EXTERNAL_ENABLED = "true";
  assert.equal(schedulerExternalEnabled(), true);

  delete process.env.GITHUB_SCHEDULER_OIDC_ENABLED;
  assert.equal(schedulerOidcReady(), true);
  assert.equal(schedulerAuthReady(), true);
  assert.match(schedulerCadenceLabel(), /OIDC scheduler/);

  process.env.GITHUB_SCHEDULER_OIDC_ENABLED = "false";
  delete process.env.CRON_SECRET;
  assert.equal(schedulerAuthReady(), false);

  process.env.CRON_SECRET = "scheduler-secret";
  assert.equal(schedulerSharedSecretReady(), true);
  assert.equal(schedulerAuthReady(), true);
} finally {
  if (previous.batch === undefined) delete process.env.SCHEDULER_BATCH_SIZE;
  else process.env.SCHEDULER_BATCH_SIZE = previous.batch;
  if (previous.external === undefined) delete process.env.SCHEDULER_EXTERNAL_ENABLED;
  else process.env.SCHEDULER_EXTERNAL_ENABLED = previous.external;
  if (previous.oidc === undefined) delete process.env.GITHUB_SCHEDULER_OIDC_ENABLED;
  else process.env.GITHUB_SCHEDULER_OIDC_ENABLED = previous.oidc;
  if (previous.secret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous.secret;
}

console.log("scheduler tests passed");
