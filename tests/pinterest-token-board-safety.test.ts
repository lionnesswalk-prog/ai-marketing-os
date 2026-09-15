import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pinterest = await readFile("apps/web/lib/pinterest-integration.ts", "utf8");
assert.ok(pinterest.includes('status: "expired"'), "expired Pinterest connections must be marked expired");
assert.ok(pinterest.includes("refreshTokenExpiresAt"), "Pinterest refresh-token expiry must be tracked");
assert.ok(pinterest.includes("refreshExpired"), "Pinterest refresh-token expiry must be enforced");
assert.ok(pinterest.includes("refreshFailedAt"), "failed Pinterest refreshes must become reconnectable");
assert.ok(pinterest.includes("refreshed.expiresAt"), "successful Pinterest refresh must update current access expiry");
assert.ok(pinterest.includes("refreshed.refreshTokenExpiresAt"), "successful Pinterest refresh must update current refresh expiry");
assert.ok(pinterest.includes('data: { metadataJson, status: "connected" }'), "successful Pinterest refresh must restore connected status");
assert.ok(pinterest.includes('url.searchParams.set("bookmark", bookmark)'), "Pinterest board listing must paginate");
assert.ok(pinterest.includes("for (let page = 0; page < 5; page += 1)"), "Pinterest board pagination must be bounded");
assert.ok(pinterest.includes("PINTEREST_BOARD_NOT_ACCESSIBLE"), "Pinterest publishing must reject stale/inaccessible board ids");

const publishRoute = await readFile("apps/web/app/api/social/publish/route.ts", "utf8");
assert.ok(publishRoute.includes("The selected Pinterest board is no longer accessible"), "Pinterest board failures must be user-friendly");

console.log("Pinterest token and board safety tests passed");
