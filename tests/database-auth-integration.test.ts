import assert from "node:assert/strict";
import { authenticateAccount, registerAccount } from "../apps/web/lib/auth-service";
import {
  assertAuthAllowed,
  clearAuthAttempts,
  loginThrottleKeys,
  recordAuthAttempt,
} from "../apps/web/lib/auth-rate-limit";
import { getPrisma } from "../apps/web/lib/prisma";

const prisma = getPrisma();
const email = "first-user@example.com";
const password = process.env.TEST_ACCOUNT_PASSWORD;
assert.ok(password && password.length >= 12);

const first = await registerAccount({
  name: "First User",
  brandName: "First Brand",
  email,
  password,
});

assert.equal(first.email, email);
assert.equal(first.role, "admin");
assert.equal(first.platformAdmin, true);
assert.equal(first.sessionVersion, 0);

const access = await prisma.workspaceAccess.findUnique({
  where: { userId_workspaceId: { userId: first.userId, workspaceId: first.workspaceId } },
});
assert.ok(access);
assert.equal(access.role, "admin");

const second = await registerAccount({
  name: "Second User",
  brandName: "Second Brand",
  email: "second-user@example.com",
  password,
});
assert.equal(second.role, "admin");
assert.equal(second.platformAdmin, false);
assert.notEqual(second.workspaceId, first.workspaceId);

const previousFreeBetaMode = process.env.FREE_BETA_MODE;
process.env.FREE_BETA_MODE = "false";
try {
  await assert.rejects(
    () => registerAccount({
      name: "Third User",
      brandName: "Third Brand",
      email: "third-user@example.com",
      password,
    }),
    /SIGNUP_CLOSED/,
  );
} finally {
  if (previousFreeBetaMode === undefined) delete process.env.FREE_BETA_MODE;
  else process.env.FREE_BETA_MODE = previousFreeBetaMode;
}

const authenticated = await authenticateAccount({ email, password });
assert.equal(authenticated.userId, first.userId);
assert.equal(authenticated.sessionVersion, 0);

const request = new Request("https://example.com/api/auth/login", {
  method: "POST",
  headers: { "x-forwarded-for": "203.0.113.10" },
});
const keys = loginThrottleKeys(request, email);
await clearAuthAttempts(keys);
for (let i = 0; i < 5; i += 1) {
  await assertAuthAllowed(keys);
  await recordAuthAttempt(keys);
}
await assert.rejects(() => assertAuthAllowed(keys), /AUTH_RATE_LIMITED/);
await clearAuthAttempts(keys);

console.log("database auth integration tests passed");
await prisma.$disconnect();
