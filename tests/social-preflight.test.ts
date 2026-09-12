import assert from "node:assert/strict";
import {
  getSocialDeliveryIssues,
  getStoredSocialPostDeliveryIssues,
  socialDeliveryIssueMessage,
  socialDeliveryIssuesByPlatform,
} from "../apps/web/lib/social-preflight";

assert.equal(getSocialDeliveryIssues({ platform: "facebook", contentType: "static", caption: "Hello" }).length, 0);
assert.equal(getSocialDeliveryIssues({ platform: "facebook", contentType: "reel", mediaUrl: "https://example.com/video.mp4" })[0]?.code, "FACEBOOK_FORMAT_NOT_READY");
assert.equal(getSocialDeliveryIssues({ platform: "instagram", contentType: "static" })[0]?.code, "INSTAGRAM_MEDIA_REQUIRED");
assert.equal(getSocialDeliveryIssues({ platform: "instagram", contentType: "reel", mediaUrl: "https://example.com/video.mp4" }).length, 0);
assert.equal(getSocialDeliveryIssues({ platform: "linkedin", contentType: "static", mediaUrl: "https://example.com/image.jpg" })[0]?.code, "LINKEDIN_MEDIA_UPLOAD_NOT_READY");
assert.equal(getSocialDeliveryIssues({ platform: "x", contentType: "static" })[0]?.code, "X_TEXT_REQUIRED");

assert.deepEqual(
  getSocialDeliveryIssues({ platform: "tiktok", contentType: "static" }).map((item) => item.code),
  ["TIKTOK_MEDIA_REQUIRED", "TIKTOK_FORMAT_NOT_READY", "TIKTOK_PRIVACY_REQUIRED"],
);

assert.equal(getSocialDeliveryIssues({
  platform: "youtube",
  contentType: "video",
  mediaUrl: "https://example.com/video.mp4",
  youtubePrivacyStatus: "private",
}).length, 0);

assert.deepEqual(
  getSocialDeliveryIssues({ platform: "pinterest", contentType: "video" }).map((item) => item.code),
  ["PINTEREST_BOARD_REQUIRED", "PINTEREST_MEDIA_REQUIRED", "PINTEREST_VIDEO_UPLOAD_NOT_READY"],
);

const stored = getStoredSocialPostDeliveryIssues({
  platform: "pinterest",
  contentType: "static",
  caption: "Pin",
  metadataJson: { mediaUrl: "https://example.com/image.jpg", pinterestBoardId: "board_1" },
});
assert.equal(stored.length, 0);

const grouped = socialDeliveryIssuesByPlatform([
  { platform: "instagram", contentType: "static" },
  { platform: "facebook", contentType: "static" },
]);
assert.equal(grouped.has("instagram"), true);
assert.equal(grouped.has("facebook"), false);
assert.match(socialDeliveryIssueMessage(grouped.get("instagram") || []), /Instagram needs/);

console.log("social preflight tests passed");
