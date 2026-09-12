import assert from "node:assert/strict";
import { createSessionToken, readSessionToken } from "../apps/web/lib/auth";
import {
  canAccessAgency,
  canViewSecurity,
  roleCan,
  type AppRole,
} from "../apps/web/lib/access-policy";
import {
  assertWorkspaceResource,
  brandIsWorkspaceScope,
  brandWorkspaceScope,
} from "../apps/web/lib/tenant-scope";

const previousAuthMode = process.env.AUTH_MODE;
const previousSecret = process.env.AUTH_SECRET;

try {
  process.env.AUTH_MODE = "preview";
  process.env.AUTH_SECRET = "qa-secret-that-is-long-enough-for-tests";

  const roles: AppRole[] = ["admin", "marketing_manager", "sales", "viewer"];
  assert.deepEqual(roles.filter((role) => roleCan(role, "marketing.manage")), ["admin", "marketing_manager"]);
  assert.deepEqual(roles.filter((role) => roleCan(role, "integrations.manage")), ["admin", "marketing_manager"]);
  assert.deepEqual(roles.filter((role) => roleCan(role, "leads.manage")), ["admin", "marketing_manager", "sales"]);
  assert.equal(canViewSecurity("admin"), true);
  assert.equal(canViewSecurity("marketing_manager"), false);
  assert.equal(canViewSecurity("viewer", true), true);
  assert.equal(canAccessAgency(false), false);
  assert.equal(canAccessAgency(true), true);

  const session = {
    email: "admin@example.com",
    role: "admin" as const,
    userId: "user_a",
    workspaceId: "workspace_a",
    platformAdmin: false,
  };
  const token = createSessionToken(session);
  const decoded = readSessionToken(token);
  assert.ok(decoded);
  assert.equal(decoded.email, session.email);
  assert.equal(decoded.role, session.role);
  assert.equal(decoded.userId, session.userId);
  assert.equal(decoded.workspaceId, session.workspaceId);
  assert.equal(decoded.platformAdmin, session.platformAdmin);

  const [payload, signature] = token.split(".");
  const tamperedPayload = (payload?.slice(0, -1) || "") + (payload?.endsWith("a") ? "b" : "a");
  assert.equal(readSessionToken(tamperedPayload + "." + signature), null);
  assert.equal(readSessionToken(payload + "." + (signature?.slice(0, -1) || "") + "x"), null);
  assert.equal(readSessionToken("malformed"), null);

  assert.deepEqual(brandIsWorkspaceScope("workspace_a"), { brand: { is: { workspaceId: "workspace_a" } } });
  assert.deepEqual(brandWorkspaceScope("workspace_b"), { brand: { workspaceId: "workspace_b" } });
  assert.doesNotThrow(() => assertWorkspaceResource("workspace_a", "workspace_a"));
  assert.throws(() => assertWorkspaceResource("workspace_a", "workspace_b"), /WORKSPACE_SCOPE_MISMATCH/);
  assert.throws(() => brandIsWorkspaceScope(""), /WORKSPACE_SCOPE_REQUIRED/);
} finally {
  if (previousAuthMode === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = previousAuthMode;
  if (previousSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousSecret;
}

console.log("security QA tests passed");
