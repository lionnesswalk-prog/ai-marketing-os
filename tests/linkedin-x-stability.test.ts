import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { exchangeLinkedInCode } from "../apps/web/lib/linkedin-integration";

const previousFetch = globalThis.fetch;
const previousClientId = process.env.LINKEDIN_CLIENT_ID;
const previousClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const previousOrgUrn = process.env.LINKEDIN_ORGANIZATION_URN;
const previousAuthorUrn = process.env.LINKEDIN_AUTHOR_URN;

try {
  process.env.LINKEDIN_CLIENT_ID = "client";
  process.env.LINKEDIN_CLIENT_SECRET = "secret";
  process.env.LINKEDIN_ORGANIZATION_URN = "urn:li:organization:WRONG_CLIENT";
  process.env.LINKEDIN_AUTHOR_URN = "urn:li:person:WRONG_CLIENT";

  let call = 0;
  globalThis.fetch = (async () => {
    call += 1;
    if (call === 1) {
      return new Response(JSON.stringify({
        access_token: "token",
        expires_in: 3600,
        scope: "openid profile email w_member_social",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      sub: "authorized_member_123",
      name: "Authorized Member",
      email: "member@example.com",
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const linkedIn = await exchangeLinkedInCode("code", "https://example.com/callback");
  assert.equal(linkedIn.authorUrn, "urn:li:person:authorized_member_123");
  assert.notEqual(linkedIn.authorUrn, process.env.LINKEDIN_ORGANIZATION_URN);
  assert.notEqual(linkedIn.authorUrn, process.env.LINKEDIN_AUTHOR_URN);
} finally {
  globalThis.fetch = previousFetch;
  if (previousClientId === undefined) delete process.env.LINKEDIN_CLIENT_ID;
  else process.env.LINKEDIN_CLIENT_ID = previousClientId;
  if (previousClientSecret === undefined) delete process.env.LINKEDIN_CLIENT_SECRET;
  else process.env.LINKEDIN_CLIENT_SECRET = previousClientSecret;
  if (previousOrgUrn === undefined) delete process.env.LINKEDIN_ORGANIZATION_URN;
  else process.env.LINKEDIN_ORGANIZATION_URN = previousOrgUrn;
  if (previousAuthorUrn === undefined) delete process.env.LINKEDIN_AUTHOR_URN;
  else process.env.LINKEDIN_AUTHOR_URN = previousAuthorUrn;
}

const linkedInSource = await readFile("apps/web/lib/linkedin-integration.ts", "utf8");
assert.ok(linkedInSource.includes('status: "expired"'), "expired LinkedIn OAuth tokens must be marked expired");
assert.ok(linkedInSource.includes('authorSource: "oauth_person"'), "LinkedIn OAuth author source must be recorded");

const xSource = await readFile("apps/web/lib/x-integration.ts", "utf8");
assert.ok(xSource.includes('status: "expired"'), "expired X connections must be marked expired");
assert.ok(xSource.includes("refreshFailedAt"), "failed X refreshes must become reconnectable state");
assert.ok(xSource.includes("refreshed.expiresAt"), "successful X refresh must update the current expiry state");

console.log("LinkedIn and X stability tests passed");
