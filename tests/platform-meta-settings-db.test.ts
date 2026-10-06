import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../apps/web/lib/prisma";
import { getMetaAppCredentials, getMetaSettingsView, saveMetaSettings } from "../apps/web/lib/platform-meta-settings";
import { buildMetaOAuthUrl, exchangeMetaCode, getMetaSetupState } from "../apps/web/lib/meta-integration";
import type { AppSession } from "../apps/web/lib/auth";

assert.equal(process.env.TEST_DATABASE_ISOLATED, "true", "Run this test only on an isolated test database");
const prisma = getPrisma();
const secretA = "a".repeat(32);
const secretB = "b".repeat(32);
const originalFetch = globalThis.fetch;
const priorAppId = process.env.META_APP_ID;
const priorSecret = process.env.META_APP_SECRET;
const tag = randomUUID();
let workspaceId = "";
let userId = "";

try {
  // This table belongs only to the isolated test branch.
  await prisma.platformProviderConfig.deleteMany();
  process.env.META_APP_ID = "111111111";
  process.env.META_APP_SECRET = "e".repeat(32);
  assert.equal((await getMetaAppCredentials())?.appId, "111111111", "environment fallback remains supported");

  const workspace = await prisma.workspace.create({ data: { name: "Meta settings test " + tag, brands: { create: { name: "Meta settings test" } } } });
  workspaceId = workspace.id;
  const user = await prisma.workspaceUser.create({ data: { email: `meta-settings-${tag}@example.test`, isPlatformAdmin: true } });
  userId = user.id;
  await prisma.workspaceAccess.create({ data: { userId, workspaceId, role: "admin" } });
  const admin: AppSession = { email: user.email, userId, workspaceId, role: "admin", platformAdmin: true, sessionVersion: 0 };

  await assert.rejects(() => getMetaSettingsView({ ...admin, platformAdmin: false }), /PLATFORM_ADMIN_REQUIRED/);
  await assert.rejects(() => saveMetaSettings({ ...admin, platformAdmin: false }, {}), /PLATFORM_ADMIN_REQUIRED/);
  await assert.rejects(() => saveMetaSettings(admin, { appId: "garbage", appSecret: secretA, revision: null }), /META_SETTINGS_INVALID/);
  await assert.rejects(() => saveMetaSettings(admin, { appId: "222222222", appSecret: "", revision: null }), /META_SETTINGS_SECRET_REQUIRED/);

  const saved = await saveMetaSettings(admin, { appId: "222222222", appSecret: secretA, revision: null });
  assert.equal(saved.source, "portal");
  assert.equal(saved.secretConfigured, true);
  assert.equal(JSON.stringify(saved).includes(secretA), false);
  const stored = await prisma.platformProviderConfig.findUniqueOrThrow({ where: { provider: "meta" } });
  assert.equal(stored.secretEncrypted.includes(secretA), false, "the stored record must contain ciphertext");
  assert.equal((await getMetaAppCredentials())?.appSecret, secretA);
  assert.equal((await getMetaAppCredentials())?.appId, "222222222", "portal settings take priority over environment variables");
  assert.equal((await getMetaSetupState()).appConfigured, true);
  const url = new URL(await buildMetaOAuthUrl("https://portal.example.test/api/integrations/meta/callback", "test-state"));
  assert.equal(url.searchParams.get("client_id"), "222222222");
  assert.equal(url.searchParams.has("client_secret"), false);

  let fetches = 0;
  globalThis.fetch = async (input) => {
    const requestUrl = new URL(String(input));
    if (requestUrl.pathname.endsWith("/oauth/access_token")) {
      assert.equal(requestUrl.searchParams.get("client_id"), "222222222");
      assert.equal(requestUrl.searchParams.get("client_secret"), secretA, "OAuth exchange must use the saved secret");
      fetches += 1;
      return Response.json({ access_token: "mock-access-token" });
    }
    return Response.json({ data: [{ id: "test-page", name: "Test page", access_token: "mock-page-token" }] });
  };
  await exchangeMetaCode("test-code", "https://portal.example.test/api/integrations/meta/callback");
  assert.equal(fetches, 2);
  globalThis.fetch = originalFetch;

  const kept = await saveMetaSettings(admin, { appId: saved.appId, appSecret: "", revision: saved.revision });
  assert.equal((await getMetaAppCredentials())?.appSecret, secretA, "blank secret keeps the matching app's existing secret");
  await assert.rejects(() => saveMetaSettings(admin, { appId: "333333333", appSecret: "", revision: kept.revision }), /META_SETTINGS_SECRET_REQUIRED/);
  await assert.rejects(() => saveMetaSettings(admin, { appId: saved.appId, appSecret: secretB, revision: saved.revision }), /META_SETTINGS_CONFLICT/);
  const rotated = await saveMetaSettings(admin, { appId: "333333333", appSecret: secretB, revision: kept.revision });
  assert.equal((await getMetaAppCredentials())?.appSecret, secretB);
  assert.equal((await getMetaSettingsView(admin)).appId, "333333333");
  const events = await prisma.auditLog.findMany({ where: { actorId: userId, action: "platform_meta_settings_updated" } });
  assert.equal(events.length, 3);
  assert.equal(JSON.stringify(events).includes(secretA) || JSON.stringify(events).includes(secretB), false);

  await prisma.workspaceUser.update({ where: { id: userId }, data: { isPlatformAdmin: false } });
  await assert.rejects(() => saveMetaSettings(admin, { appId: rotated.appId, appSecret: secretA, revision: rotated.revision }), /PLATFORM_ADMIN_REQUIRED/, "stale sessions must not preserve revoked admin access");
  await prisma.platformProviderConfig.update({ where: { provider: "meta" }, data: { secretEncrypted: "corrupted" } });
  await assert.rejects(() => getMetaAppCredentials(), /META_SETTINGS_UNAVAILABLE/);
  assert.equal((await getMetaSetupState()).appConfigured, false, "unreadable portal credentials must not fall back to a different environment app");
  assert.equal((await getMetaSetupState()).configurationError, true);
  console.log("Meta credentials encryption, permissions, rotation and OAuth integration tests passed");
} finally {
  globalThis.fetch = originalFetch;
  if (priorAppId === undefined) delete process.env.META_APP_ID; else process.env.META_APP_ID = priorAppId;
  if (priorSecret === undefined) delete process.env.META_APP_SECRET; else process.env.META_APP_SECRET = priorSecret;
  await prisma.platformProviderConfig.deleteMany();
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } });
  if (userId) await prisma.workspaceUser.delete({ where: { id: userId } });
  await prisma.$disconnect();
}
