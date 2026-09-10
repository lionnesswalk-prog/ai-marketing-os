import type { OptimizationAction } from "./types";

export const budgetPolicy = {
  maxDailyBudgetIncreasePct: 20,
  maxDailyBudgetDecreasePct: 50,
  requireApprovalForPause: true,
  requireApprovalForNewCampaign: true,
  requireApprovalForAnySpendChange: true,
};

export function enforceBudgetPolicy(action: OptimizationAction): OptimizationAction {
  const impact = Math.abs(action.spendImpactPct ?? 0);
  const spendChange = action.action === "increase_budget" || action.action === "decrease_budget";

  if (action.action === "increase_budget" && impact > budgetPolicy.maxDailyBudgetIncreasePct) {
    return {
      ...action,
      spendImpactPct: budgetPolicy.maxDailyBudgetIncreasePct,
      requiresApproval: true,
      reason: `${action.reason} Change capped by budget policy.`,
    };
  }

  if (action.action === "decrease_budget" && impact > budgetPolicy.maxDailyBudgetDecreasePct) {
    return {
      ...action,
      spendImpactPct: budgetPolicy.maxDailyBudgetDecreasePct,
      requiresApproval: true,
      reason: `${action.reason} Change capped by budget policy.`,
    };
  }

  return {
    ...action,
    requiresApproval:
      action.requiresApproval ||
      (spendChange && budgetPolicy.requireApprovalForAnySpendChange) ||
      (action.action === "pause" && budgetPolicy.requireApprovalForPause),
  };
}
