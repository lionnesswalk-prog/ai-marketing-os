import { getPrisma } from "../apps/web/lib/prisma";

const prisma = getPrisma();

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: "workspace_internal" },
    update: {},
    create: { id: "workspace_internal", name: "Internal Marketing Workspace" },
  });

  const brand = await prisma.brand.upsert({
    where: { id: "brand_lioness_walk" },
    update: {},
    create: {
      id: "brand_lioness_walk",
      workspaceId: workspace.id,
      name: "Lioness Walk",
      voiceJson: {
        personality: ["composed", "feminine", "intentional", "rare", "quiet luxury"],
        avoid: ["generic hype", "fake urgency", "unsupported claims"],
      },
    },
  });

  await prisma.workspaceUser.upsert({
    where: { workspaceId_email: { workspaceId: workspace.id, email: process.env.DEV_USER_EMAIL ?? "owner@example.com" } },
    update: { role: "admin" },
    create: { workspaceId: workspace.id, email: process.env.DEV_USER_EMAIL ?? "owner@example.com", role: "admin" },
  });

  const campaign = await prisma.campaign.upsert({
    where: { brandId_channel_externalId: { brandId: brand.id, channel: "meta", externalId: "demo-festive" } },
    update: {},
    create: {
      brandId: brand.id,
      externalId: "demo-festive",
      channel: "meta",
      name: "Festive Prospecting",
      status: "active",
      dailyBudget: 3200,
    },
  });

  const metricCount = await prisma.campaignMetric.count({ where: { campaignId: campaign.id } });
  if (!metricCount) {
    await prisma.campaignMetric.create({
      data: { campaignId: campaign.id, spend: 8200, impressions: 120000, clicks: 3100, conversions: 62, revenue: 39360, frequency: 1.8 },
    });
  }

  const insight = await prisma.marketingInsight.findFirst({
    where: { brandId: brand.id, title: "Festive Prospecting can support a controlled scale test" },
  });
  if (!insight) {
    await prisma.marketingInsight.create({
      data: {
        brandId: brand.id,
        kind: "budget",
        title: "Festive Prospecting can support a controlled scale test",
        detail: "ROAS and conversion volume are strong. Keep any spend increase within policy and require approval.",
        severity: "info",
      },
    });
  }

  console.log(`Seeded workspace ${workspace.id} and brand ${brand.id}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
