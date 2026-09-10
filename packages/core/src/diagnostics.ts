import { enforceBudgetPolicy } from "./guardrails";
import { campaignMetrics } from "./metrics";
import type { CampaignDiagnosis, CampaignSnapshot, OptimizationAction } from "./types";

const THRESHOLDS = {
  lowCtr: 0.008,
  weakConversionRate: 0.012,
  highFrequency: 3.5,
  weakRoas: 1.5,
  strongRoas: 4,
};

export function diagnoseCampaign(campaign: CampaignSnapshot): CampaignDiagnosis {
  const metrics = campaignMetrics(campaign);
  const actions: OptimizationAction[] = [];
  const issues: string[] = [];

  if (metrics.ctr < THRESHOLDS.lowCtr && campaign.impressions >= 5000) {
    issues.push("Low click-through rate suggests the creative or offer is not earning attention.");
    actions.push(
      enforceBudgetPolicy({
        campaignId: campaign.id,
        action: "refresh_creative",
        reason: "CTR is below the starter threshold after meaningful delivery. Test a new hook/creative before scaling spend.",
        confidence: 0.82,
        requiresApproval: false,
      }),
    );
  }

  if (metrics.ctr >= THRESHOLDS.lowCtr && metrics.conversionRate < THRESHOLDS.weakConversionRate && campaign.clicks >= 100) {
    issues.push("Traffic is arriving, but too few visitors convert; the landing page, merchandising or checkout needs inspection.");
    actions.push(
      enforceBudgetPolicy({
        campaignId: campaign.id,
        action: "inspect_landing_page",
        reason: "CTR is acceptable while post-click conversion is weak. Diagnose product page and checkout friction before changing targeting.",
        confidence: 0.86,
        requiresApproval: false,
      }),
    );
  }

  if ((metrics.frequency ?? 0) >= THRESHOLDS.highFrequency) {
    issues.push("Frequency is high enough to watch for creative fatigue.");
    actions.push(
      enforceBudgetPolicy({
        campaignId: campaign.id,
        action: "refresh_creative",
        reason: "Frequency has crossed the starter fatigue threshold. Rotate fresh creative before performance degrades further.",
        confidence: 0.78,
        requiresApproval: false,
      }),
    );
  }

  if (metrics.roas > 0 && metrics.roas < THRESHOLDS.weakRoas && campaign.spend >= 1000) {
    issues.push("Return on ad spend is materially weak for the starter policy.");
    actions.push(
      enforceBudgetPolicy({
        campaignId: campaign.id,
        action: "decrease_budget",
        reason: "ROAS is weak after meaningful spend. Reduce exposure while the root cause is tested.",
        confidence: 0.74,
        spendImpactPct: 25,
        requiresApproval: true,
      }),
    );
  }

  if (metrics.roas >= THRESHOLDS.strongRoas && campaign.conversions >= 20) {
    actions.push(
      enforceBudgetPolicy({
        campaignId: campaign.id,
        action: "increase_budget",
        reason: "ROAS and conversion volume are strong enough to consider a controlled scale test.",
        confidence: 0.72,
        spendImpactPct: 15,
        requiresApproval: true,
      }),
    );
  }

  const health: CampaignDiagnosis["health"] =
    issues.length >= 2 || metrics.roas < THRESHOLDS.weakRoas ? "needs_action" : issues.length === 1 ? "watch" : "healthy";

  return {
    campaignId: campaign.id,
    health,
    summary: issues.length ? issues.join(" ") : "No starter-rule issue is currently strong enough to trigger an intervention.",
    metrics,
    actions: dedupeActions(actions),
  };
}

function dedupeActions(actions: OptimizationAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.campaignId}:${action.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
