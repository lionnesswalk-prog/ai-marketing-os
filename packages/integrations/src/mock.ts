import type { AdsProvider, MessagingProvider } from "./contracts";
import type { CampaignSnapshot, Lead, OptimizationAction } from "../../core/src/types";

export class MockAdsProvider implements AdsProvider {
  async getCampaignSnapshots(): Promise<CampaignSnapshot[]> {
    return [
      { id:"c1", name:"Festive Prospecting", channel:"meta", spend:8200, impressions:120000, clicks:3100, conversions:62, revenue:39360, frequency:1.8 },
      { id:"c2", name:"Creative Test B", channel:"meta", spend:2520, impressions:44000, clicks:420, conversions:7, revenue:3024, frequency:2.7 }
    ];
  }
  async applyOptimization(action: OptimizationAction) {
    return { applied: !action.requiresApproval, externalId: `mock-${action.campaignId}` };
  }
}

export class MockMessagingProvider implements MessagingProvider {
  async fetchNewLeads(): Promise<Lead[]> {
    return [{ id:"IG-1024", source:"instagram", message:"Do you have this dress in Medium?", intent:"high", status:"new" }];
  }
  async sendReply(leadId: string, message: string) {
    console.log({ leadId, message });
    return { sent:true };
  }
}
