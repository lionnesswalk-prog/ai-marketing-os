import assert from "node:assert/strict";
import { diagnoseCampaign } from "../packages/core/src/diagnostics";
import { enforceBudgetPolicy } from "../packages/core/src/guardrails";

const capped = enforceBudgetPolicy({
  campaignId: "x",
  action: "increase_budget",
  reason: "Scale winner.",
  confidence: 0.9,
  spendImpactPct: 75,
  requiresApproval: false,
});
assert.equal(capped.spendImpactPct, 20);
assert.equal(capped.requiresApproval, true);

const weak = diagnoseCampaign({
  id: "weak",
  name: "Weak campaign",
  channel: "meta",
  spend: 2500,
  impressions: 50000,
  clicks: 200,
  conversions: 2,
  revenue: 1200,
  frequency: 4.2,
});
assert.equal(weak.health, "needs_action");
assert.ok(weak.actions.some((x) => x.action === "refresh_creative"));
assert.ok(weak.actions.some((x) => x.action === "decrease_budget"));

const strong = diagnoseCampaign({
  id: "strong",
  name: "Strong campaign",
  channel: "meta",
  spend: 5000,
  impressions: 100000,
  clicks: 2500,
  conversions: 75,
  revenue: 30000,
  frequency: 1.8,
});
assert.ok(strong.actions.some((x) => x.action === "increase_budget"));
assert.ok(strong.actions.find((x) => x.action === "increase_budget")?.requiresApproval);

console.log("core tests passed");
