export type Channel = "meta" | "google" | "instagram" | "whatsapp" | "website";

export type CampaignSnapshot = {
  id: string;
  name: string;
  channel: Channel;
  status?: "active" | "paused" | "draft";
  dailyBudget?: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  frequency?: number;
};

export type OptimizationActionName =
  | "pause"
  | "increase_budget"
  | "decrease_budget"
  | "refresh_creative"
  | "inspect_landing_page";

export type OptimizationAction = {
  id?: string;
  campaignId: string;
  action: OptimizationActionName;
  reason: string;
  confidence: number;
  spendImpactPct?: number;
  requiresApproval: boolean;
};

export type CampaignDiagnosis = {
  campaignId: string;
  health: "healthy" | "watch" | "needs_action";
  summary: string;
  metrics: ReturnType<typeof import("./metrics").campaignMetrics>;
  actions: OptimizationAction[];
};

export type Lead = {
  id: string;
  source: Channel;
  customerName?: string;
  message: string;
  intent: "low" | "medium" | "high";
  status: "new" | "answered" | "follow_up" | "human_handoff";
};
