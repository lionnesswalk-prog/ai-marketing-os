import type { CampaignSnapshot, Lead, OptimizationAction } from "../../core/src/types";

export interface AdsProvider {
  getCampaignSnapshots(): Promise<CampaignSnapshot[]>;
  applyOptimization(action: OptimizationAction): Promise<{ applied: boolean; externalId?: string }>;
}

export interface MessagingProvider {
  fetchNewLeads(): Promise<Lead[]>;
  sendReply(leadId: string, message: string): Promise<{ sent: boolean }>;
}
