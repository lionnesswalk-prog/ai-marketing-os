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
  interval: process.env.SCHEDULER_EXTERNAL_INTERVAL_MINUTES,
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

  assert.equal(schedulerExternalEnabled(), true);
  assert.equal(schedulerOidcReady(), true);
  assert.equal(schedulerAuthReady(), true);
  assert.match(schedulerCadenceLabel(), /OIDC scheduler/);

  delete process.env.CRON_SECRET;
  assert.equal(schedulerSharedSecretReady(), false);
  assert.equal(schedulerAuthReady(), true);

  process.env.CRON_SECRET = "scheduler-secret";
  assert.equal(schedulerSharedSecretReady(), true);
  assert.equal(schedulerAuthReady(), true);
} finally {
  if (previous.batch === undefined) delete process.env.SCHEDULER_BATCH_SIZE;
  else process.env.SCHEDULER_BATCH_SIZE = previous.batch;
  if (previous.interval === undefined) delete process.env.SCHEDULER_EXTERNAL_INTERVAL_MINUTES;
  else process.env.SCHEDULER_EXTERNAL_INTERVAL_MINUTES = previous.interval;
  if (previous.secret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous.secret;
}

console.log("scheduler tests passed");
