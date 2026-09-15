import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tikTok = await readFile("apps/web/lib/tiktok-integration.ts", "utf8");
assert.ok(tikTok.includes('status: "expired"'), "expired TikTok connections must be marked expired");
assert.ok(tikTok.includes("refreshExpiresAt"), "TikTok refresh token expiry must be tracked");
assert.ok(tikTok.includes("refreshExpired"), "TikTok refresh token expiry must be enforced");
assert.ok(tikTok.includes("refreshFailedAt"), "failed TikTok refreshes must become reconnectable");
assert.ok(tikTok.includes("refreshed.expiresAt"), "TikTok successful refresh must update current access expiry");
assert.ok(tikTok.includes("refreshed.refreshExpiresAt"), "TikTok successful refresh must update current refresh expiry");
assert.ok(tikTok.includes('data: { metadataJson, status: "connected" }'), "TikTok successful refresh must restore connected status");

const youTube = await readFile("apps/web/lib/youtube-integration.ts", "utf8");
assert.ok(youTube.includes('status: "expired"'), "expired YouTube connections must be marked expired");
assert.ok(youTube.includes("refreshFailedAt"), "failed YouTube refreshes must become reconnectable");
assert.ok(youTube.includes("refreshed.expiresAt"), "YouTube successful refresh must update current expiry");
assert.ok(youTube.includes('data: { metadataJson, status: "connected" }'), "YouTube successful refresh must restore connected status");

console.log("TikTok and YouTube token lifecycle tests passed");
