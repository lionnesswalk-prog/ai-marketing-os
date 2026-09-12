import assert from "node:assert/strict";
import {
  matchesSchedulerSharedSecret,
  schedulerOidcAudience,
  validateGitHubSchedulerClaims,
} from "../apps/web/lib/github-scheduler-oidc";

const now = 2_000_000_000;
const valid = {
  iss: "https://token.actions.githubusercontent.com",
  aud: schedulerOidcAudience,
  exp: now + 300,
  nbf: now - 10,
  iat: now - 10,
  repository: "lionnesswalk-prog/ai-marketing-os",
  ref: "refs/heads/main",
  workflow_ref: "lionnesswalk-prog/ai-marketing-os/.github/workflows/social-scheduler.yml@refs/heads/main",
  event_name: "schedule",
};

assert.equal(validateGitHubSchedulerClaims(valid, now), true);
assert.equal(validateGitHubSchedulerClaims({ ...valid, event_name: "workflow_dispatch" }, now), true);
assert.equal(validateGitHubSchedulerClaims({ ...valid, repository: "other/repo" }, now), false);
assert.equal(validateGitHubSchedulerClaims({ ...valid, ref: "refs/heads/feature" }, now), false);
assert.equal(validateGitHubSchedulerClaims({ ...valid, workflow_ref: "lionnesswalk-prog/ai-marketing-os/.github/workflows/ci.yml@refs/heads/main" }, now), false);
assert.equal(validateGitHubSchedulerClaims({ ...valid, aud: "wrong-audience" }, now), false);
assert.equal(validateGitHubSchedulerClaims({ ...valid, exp: now - 60 }, now), false);
assert.equal(validateGitHubSchedulerClaims({ ...valid, event_name: "pull_request" }, now), false);

assert.equal(matchesSchedulerSharedSecret("same", "same"), true);
assert.equal(matchesSchedulerSharedSecret("wrong", "same"), false);
assert.equal(matchesSchedulerSharedSecret("same", undefined), false);

console.log("github scheduler oidc tests passed");
