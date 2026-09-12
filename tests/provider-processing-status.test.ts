import assert from "node:assert/strict";
import {
  classifyTikTokPublishStatus,
  classifyYouTubePublishStatus,
} from "../apps/web/lib/provider-processing-status";

assert.equal(classifyTikTokPublishStatus("PUBLISH_COMPLETE"), "published");
assert.equal(classifyTikTokPublishStatus("FAILED"), "failed");
assert.equal(classifyTikTokPublishStatus("PROCESSING_UPLOAD"), "publishing");

assert.equal(classifyYouTubePublishStatus({ uploadStatus: "failed" }), "failed");
assert.equal(classifyYouTubePublishStatus({ uploadStatus: "rejected" }), "failed");
assert.equal(classifyYouTubePublishStatus({ uploadStatus: "processed" }), "published");
assert.equal(classifyYouTubePublishStatus({ uploadStatus: "uploaded", processingStatus: "succeeded" }), "published");
assert.equal(classifyYouTubePublishStatus({ uploadStatus: "uploaded", processingStatus: "processing" }), "publishing");

console.log("provider processing status tests passed");
