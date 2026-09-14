import assert from "node:assert/strict";
import { isPrivateNetworkAddress } from "../apps/web/lib/public-media";
import { getSignupMode } from "../apps/web/lib/auth-service";

assert.equal(isPrivateNetworkAddress("127.0.0.1"), true);
assert.equal(isPrivateNetworkAddress("10.0.0.1"), true);
assert.equal(isPrivateNetworkAddress("169.254.169.254"), true);
assert.equal(isPrivateNetworkAddress("192.168.1.5"), true);
assert.equal(isPrivateNetworkAddress("172.16.0.1"), true);
assert.equal(isPrivateNetworkAddress("::1"), true);
assert.equal(isPrivateNetworkAddress("fd00::1"), true);
assert.equal(isPrivateNetworkAddress("8.8.8.8"), false);
assert.equal(isPrivateNetworkAddress("2001:4860:4860::8888"), false);

const previousSignupMode = process.env.SIGNUP_MODE;
const previousVercelEnv = process.env.VERCEL_ENV;
const previousFreeBetaMode = process.env.FREE_BETA_MODE;
try {
  delete process.env.SIGNUP_MODE;
  delete process.env.FREE_BETA_MODE;
  process.env.VERCEL_ENV = "production";
  assert.equal(getSignupMode(), "open");

  process.env.SIGNUP_MODE = "closed";
  assert.equal(getSignupMode(), "open");
  process.env.SIGNUP_MODE = "first_user";
  assert.equal(getSignupMode(), "open");

  process.env.FREE_BETA_MODE = "false";
  process.env.SIGNUP_MODE = "open";
  assert.equal(getSignupMode(), "open");
  process.env.SIGNUP_MODE = "closed";
  assert.equal(getSignupMode(), "closed");
  process.env.SIGNUP_MODE = "first_user";
  assert.equal(getSignupMode(), "first_user");
} finally {
  if (previousSignupMode === undefined) delete process.env.SIGNUP_MODE;
  else process.env.SIGNUP_MODE = previousSignupMode;
  if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousVercelEnv;
  if (previousFreeBetaMode === undefined) delete process.env.FREE_BETA_MODE;
  else process.env.FREE_BETA_MODE = previousFreeBetaMode;
}

console.log("security hardening tests passed");
