import assert from "node:assert/strict";
import { handleMetaSettingsSave } from "../apps/web/lib/platform-meta-request";
import type { AppSession } from "../apps/web/lib/auth";

const admin: AppSession = { email: "admin@example.test", userId: "admin", workspaceId: "workspace", role: "admin", platformAdmin: true };
const endpoint = "https://portal.example.test/api/platform/providers/meta";
let writes = 0;
const settings = { appId: "123456789", secretConfigured: true, source: "portal" as const, revision: "new", updatedAt: null, storageReady: true };
function request(body = '{"appId":"123456789","appSecret":"test-secret-only","revision":null}', headers: Record<string, string> = {}) {
  return new Request(endpoint, { method: "POST", headers: { origin: "https://portal.example.test", "content-type": "application/json", ...headers }, body });
}
const save = async () => { writes += 1; return settings; };

assert.equal((await handleMetaSettingsSave(request(), { getSession: async () => null, save })).status, 401);
for (const role of ["admin", "marketing_manager", "sales", "viewer"] as const) {
  assert.equal((await handleMetaSettingsSave(request(), { getSession: async () => ({ ...admin, role, platformAdmin: false }), save })).status, 403);
}
for (const origin of ["https://attacker.example", "null", ""]) {
  assert.equal((await handleMetaSettingsSave(request(undefined, { origin }), { getSession: async () => admin, save })).status, 403);
}
assert.equal((await handleMetaSettingsSave(request(undefined, { "sec-fetch-site": "cross-site" }), { getSession: async () => admin, save })).status, 403);
assert.equal((await handleMetaSettingsSave(request(undefined, { "content-type": "text/plain" }), { getSession: async () => admin, save })).status, 415);
assert.equal((await handleMetaSettingsSave(request("not json"), { getSession: async () => admin, save })).status, 400);
assert.equal((await handleMetaSettingsSave(request("x".repeat(4097)), { getSession: async () => admin, save })).status, 413);
assert.equal(writes, 0, "unauthorized, cross-origin and malformed requests must never reach storage");

const response = await handleMetaSettingsSave(request(), { getSession: async () => admin, save });
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
const serialized = await response.text();
assert.equal(serialized.includes("test-secret-only"), false);
assert.equal(serialized.includes("secretEncrypted"), false);
assert.equal(JSON.parse(serialized).settings.secretConfigured, true);
assert.equal(writes, 1);

const failure = await handleMetaSettingsSave(request(), {
  getSession: async () => admin,
  save: async () => { throw new Error("database error containing test-secret-only"); },
});
assert.equal(failure.status, 503);
assert.equal((await failure.text()).includes("test-secret-only"), false, "internal errors must not leak secrets");
console.log("Meta settings request security tests passed");
