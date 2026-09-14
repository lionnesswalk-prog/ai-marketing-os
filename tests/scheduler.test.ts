import assert from "node:assert/strict";
import {
  schedulerAuthReady,
  schedulerBatchSize,
  schedulerCadenceLabel,
  schedulerDurableEnabled,
  schedulerExternalEnabled,
  schedulerOidcReady,
  schedulerSharedSecretReady,
} from "../apps/web/lib/scheduler-config";

const previous = {
  batch: process.env.SCHEDULER_BATCH_SIZE,
  durable: process.env.DURABLE_SOCIAL_SCHEDULER_ENABLED,
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

  delete process.env.DURABLE_SOCIAL_SCHEDULER_ENABLED;
  assert.equal(schedulerDurableEnabled(), true);
  assert.equal(schedulerExternalEnabled(), true);
  assert.equal(schedulerAuthReady(), true);
  assert.match(schedulerCadenceLabel(), /Durable exact-time delivery/);

  process.env.DURABLE_SOCIAL_SCHEDULER_ENABLED = "false";
  assert.equal(schedulerDurableEnabled(), false);
  assert.equal(schedulerExternalEnabled(), false);
  assert.equal(schedulerAuthReady(), false);

  delete process.env.GITHUB_SCHEDULER_OIDC_ENABLED;
  assert.equal(schedulerOidcReady(), true);
  process.env.GITHUB_SCHEDULER_OIDC_ENABLED = "false";
  assert.equal(schedulerOidcReady(), false);

  delete process.env.CRON_SECRET;
  assert.equal(schedulerSharedSecretReady(), false);
  process.env.CRON_SECRET = "scheduler-secret";
  assert.equal(schedulerSharedSecretReady(), true);
} finally {
  if (previous.batch === undefined) delete process.env.SCHEDULER_BATCH_SIZE;
  else process.env.SCHEDULER_BATCH_SIZE = previous.batch;
  if (previous.durable === undefined) delete process.env.DURABLE_SOCIAL_SCHEDULER_ENABLED;
  else process.env.DURABLE_SOCIAL_SCHEDULER_ENABLED = previous.durable;
  if (previous.oidc === undefined) delete process.env.GITHUB_SCHEDULER_OIDC_ENABLED;
  else process.env.GITHUB_SCHEDULER_OIDC_ENABLED = previous.oidc;
  if (previous.secret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous.secret;
}

console.log("scheduler tests passed");
