import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { billingEntitlementsEnforced, billingLimitsEnforced, getBillingPlans, getBillingSetupState, getStripeCredentialMode, shouldManageSubscriptionInPortal, verifyStripeWebhook } from "../apps/web/lib/billing";

const previous = {
  enforce: process.env.BILLING_ENFORCE_LIMITS,
  enforceEntitlements: process.env.BILLING_ENFORCE_ENTITLEMENTS,
  stripeSecret: process.env.STRIPE_SECRET_KEY,
  starterPrice: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  growthPrice: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
  scalePrice: process.env.STRIPE_PRICE_SCALE_MONTHLY,
  starterDisplay: process.env.BILLING_STARTER_DISPLAY_PRICE,
  starterAmount: process.env.BILLING_STARTER_MONTHLY_AMOUNT_INR,
  starterMembers: process.env.BILLING_STARTER_MEMBER_LIMIT,
  webhook: process.env.STRIPE_WEBHOOK_SECRET,
};

try {
  process.env.BILLING_ENFORCE_LIMITS = "false";
  assert.equal(billingLimitsEnforced(), false);
  process.env.BILLING_ENFORCE_LIMITS = "true";
  assert.equal(billingLimitsEnforced(), true);
  process.env.BILLING_ENFORCE_ENTITLEMENTS = "false";
  assert.equal(billingEntitlementsEnforced(), false);
  process.env.BILLING_ENFORCE_ENTITLEMENTS = "true";
  assert.equal(billingEntitlementsEnforced(), true);

  process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_test_starter";
  process.env.BILLING_STARTER_DISPLAY_PRICE = "Test display";
  process.env.BILLING_STARTER_MONTHLY_AMOUNT_INR = "2999";
  process.env.BILLING_STARTER_MEMBER_LIMIT = "5";
  const starter = getBillingPlans().find((plan) => plan.key === "starter");
  assert.equal(starter?.priceId, "price_test_starter");
  assert.equal(starter?.displayPrice, "Test display");
  assert.equal(starter?.monthlyAmountInr, 2999);
  assert.equal(starter?.limits.members, 5);
  assert.equal(starter?.entitlements.includes("campaignDrafts"), false);

  process.env.STRIPE_SECRET_KEY = "sk_test_only";
  assert.equal(getStripeCredentialMode(), "test");
  process.env.STRIPE_PRICE_GROWTH_MONTHLY = "price_test_growth";
  process.env.STRIPE_PRICE_SCALE_MONTHLY = "price_test_scale";
  const growth = getBillingPlans().find((plan) => plan.key === "growth");
  assert.equal(growth?.entitlements.includes("campaignDrafts"), true);
  const setup = getBillingSetupState();
  assert.equal(setup.checkoutConfigured, true);
  assert.equal(setup.portalConfigured, true);
  assert.equal(setup.configuredPlanCount, 3);
  assert.equal(setup.allPlanPricesConfigured, true);
  process.env.STRIPE_SECRET_KEY = "sk_live_only";
  assert.equal(getStripeCredentialMode(), "live");
  process.env.STRIPE_SECRET_KEY = "sk_test_only";

  assert.equal(shouldManageSubscriptionInPortal("active", "sub_test"), true);
  assert.equal(shouldManageSubscriptionInPortal("past_due", "sub_test"), true);
  assert.equal(shouldManageSubscriptionInPortal("canceled", "sub_test"), false);
  assert.equal(shouldManageSubscriptionInPortal("active", undefined), false);

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
  if (previous.enforceEntitlements === undefined) delete process.env.BILLING_ENFORCE_ENTITLEMENTS; else process.env.BILLING_ENFORCE_ENTITLEMENTS = previous.enforceEntitlements;
  if (previous.stripeSecret === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous.stripeSecret;
  if (previous.starterPrice === undefined) delete process.env.STRIPE_PRICE_STARTER_MONTHLY; else process.env.STRIPE_PRICE_STARTER_MONTHLY = previous.starterPrice;
  if (previous.growthPrice === undefined) delete process.env.STRIPE_PRICE_GROWTH_MONTHLY; else process.env.STRIPE_PRICE_GROWTH_MONTHLY = previous.growthPrice;
  if (previous.scalePrice === undefined) delete process.env.STRIPE_PRICE_SCALE_MONTHLY; else process.env.STRIPE_PRICE_SCALE_MONTHLY = previous.scalePrice;
  if (previous.starterDisplay === undefined) delete process.env.BILLING_STARTER_DISPLAY_PRICE; else process.env.BILLING_STARTER_DISPLAY_PRICE = previous.starterDisplay;
  if (previous.starterAmount === undefined) delete process.env.BILLING_STARTER_MONTHLY_AMOUNT_INR; else process.env.BILLING_STARTER_MONTHLY_AMOUNT_INR = previous.starterAmount;
  if (previous.starterMembers === undefined) delete process.env.BILLING_STARTER_MEMBER_LIMIT; else process.env.BILLING_STARTER_MEMBER_LIMIT = previous.starterMembers;
  if (previous.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previous.webhook;
}
