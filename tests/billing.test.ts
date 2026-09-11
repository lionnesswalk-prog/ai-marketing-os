import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { billingLimitsEnforced, getBillingPlans, verifyStripeWebhook } from "../apps/web/lib/billing";

const previous = {
  enforce: process.env.BILLING_ENFORCE_LIMITS,
  starterPrice: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  starterDisplay: process.env.BILLING_STARTER_DISPLAY_PRICE,
  starterMembers: process.env.BILLING_STARTER_MEMBER_LIMIT,
  webhook: process.env.STRIPE_WEBHOOK_SECRET,
};

try {
  process.env.BILLING_ENFORCE_LIMITS = "false";
  assert.equal(billingLimitsEnforced(), false);
  process.env.BILLING_ENFORCE_LIMITS = "true";
  assert.equal(billingLimitsEnforced(), true);

  process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_test_starter";
  process.env.BILLING_STARTER_DISPLAY_PRICE = "Test display";
  process.env.BILLING_STARTER_MEMBER_LIMIT = "5";
  const starter = getBillingPlans().find((plan) => plan.key === "starter");
  assert.equal(starter?.priceId, "price_test_starter");
  assert.equal(starter?.displayPrice, "Test display");
  assert.equal(starter?.limits.members, 5);

  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_only";
  const payload = JSON.stringify({ id: "evt_test", type: "customer.subscription.updated" });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
    .update(timestamp + "." + payload)
    .digest("hex");

  assert.equal(verifyStripeWebhook(payload, "t=" + timestamp + ",v1=" + signature), true);
  assert.equal(verifyStripeWebhook(payload + "x", "t=" + timestamp + ",v1=" + signature), false);
  assert.equal(verifyStripeWebhook(payload, "t=" + (timestamp - 601) + ",v1=" + signature), false);

  console.log("billing tests passed");
} finally {
  if (previous.enforce === undefined) delete process.env.BILLING_ENFORCE_LIMITS; else process.env.BILLING_ENFORCE_LIMITS = previous.enforce;
  if (previous.starterPrice === undefined) delete process.env.STRIPE_PRICE_STARTER_MONTHLY; else process.env.STRIPE_PRICE_STARTER_MONTHLY = previous.starterPrice;
  if (previous.starterDisplay === undefined) delete process.env.BILLING_STARTER_DISPLAY_PRICE; else process.env.BILLING_STARTER_DISPLAY_PRICE = previous.starterDisplay;
  if (previous.starterMembers === undefined) delete process.env.BILLING_STARTER_MEMBER_LIMIT; else process.env.BILLING_STARTER_MEMBER_LIMIT = previous.starterMembers;
  if (previous.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previous.webhook;
}
