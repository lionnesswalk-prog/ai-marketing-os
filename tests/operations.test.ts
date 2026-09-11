import assert from "node:assert/strict";
import { classifyQueueHealth } from "../apps/web/lib/operations-health";

assert.deepEqual(
  classifyQueueHealth({ overdueScheduled: 0, stalePublishing: 0, longProcessing: 0, failedLast24h: 0 }).state,
  "healthy",
);

assert.deepEqual(
  classifyQueueHealth({ overdueScheduled: 2, stalePublishing: 0, longProcessing: 0, failedLast24h: 0 }).state,
  "watch",
);

assert.deepEqual(
  classifyQueueHealth({ overdueScheduled: 0, stalePublishing: 1, longProcessing: 0, failedLast24h: 0 }).state,
  "action",
);

assert.deepEqual(
  classifyQueueHealth({ overdueScheduled: 0, stalePublishing: 0, longProcessing: 0, failedLast24h: 3 }).state,
  "action",
);

console.log("operations tests passed");
