import assert from "node:assert/strict";
import { authenticateAccount } from "../apps/web/lib/auth-service";

const previous = process.env.PREVIEW_TESTING_MODE;
try {
  process.env.PREVIEW_TESTING_MODE = "true";

  const session = await authenticateAccount({
    email: "tester@example.com",
    password: "Test@AI2026!",
  });

  assert.equal(session.email, "tester@example.com");
  assert.equal(session.role, "admin");
  assert.equal(session.userId, "preview_user");
  assert.equal(session.workspaceId, "preview_workspace");

  await assert.rejects(
    () => authenticateAccount({
      email: "tester@example.com",
      password: "wrong-password",
    }),
    /INVALID_CREDENTIALS/,
  );
} finally {
  if (previous === undefined) delete process.env.PREVIEW_TESTING_MODE;
  else process.env.PREVIEW_TESTING_MODE = previous;
}

console.log("shared preview login tests passed");
