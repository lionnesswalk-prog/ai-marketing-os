import type { CampaignSnapshot } from "./types";

export function campaignMetrics(c: CampaignSnapshot) {
  const ctr = c.impressions ? c.clicks / c.impressions : 0;
  const cpc = c.clicks ? c.spend / c.clicks : 0;
  const cpa = c.conversions ? c.spend / c.conversions : Number.POSITIVE_INFINITY;
  const roas = c.spend ? c.revenue / c.spend : 0;
  const conversionRate = c.clicks ? c.conversions / c.clicks : 0;
  return { ctr, cpc, cpa, roas, conversionRate, frequency: c.frequency ?? null };
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}
