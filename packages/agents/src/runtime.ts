import { run } from "@openai/agents";
import { contentAgent, inquiryAgent, strategistAgent } from "./marketingAgents";

export type StrategyInput = {
  brandName: string;
  budget: number;
  objective: string;
  product?: string;
  notes?: string;
  brandContext?: string;
};

export type ContentPlanInput = {
  brandName: string;
  theme: string;
  objective: string;
  brandVoice: string;
  brandContext?: string;
};

export async function buildStrategy(input: StrategyInput) {
  if (process.env.AI_MODE !== "live" || !process.env.OPENAI_API_KEY) return mockStrategy(input);

  const result = await run(
    strategistAgent,
    JSON.stringify({
      task: "Build a practical 30-day marketing plan.",
      ...input,
      rules: [
        "Use the supplied brand context as the source of truth for positioning and tone.",
        "Channel budget percentages must sum to 100.",
        "Do not fabricate historical performance, customer proof or product facts.",
        "Mark assumptions explicitly.",
      ],
    }),
  );
  return result.finalOutput;
}

export async function buildContentPlan(input: ContentPlanInput) {
  if (process.env.AI_MODE !== "live" || !process.env.OPENAI_API_KEY) {
    const theme = input.theme.trim();
    const objective = input.objective.trim();
    return {
      theme,
      posts: [
        {
          platform: "Instagram",
          format: "Reel",
          hook: `What should customers understand about ${theme}?`,
          caption: `${input.brandName}: a focused story about ${theme.toLowerCase()}, built to support ${objective.toLowerCase()}.`,
          cta: "Discover more",
        },
        {
          platform: "Instagram",
          format: "Carousel",
          hook: "The value, proof and decision points in one clear story.",
          caption: `A practical breakdown of ${theme.toLowerCase()} for the audience most likely to care about it.`,
          cta: "Explore the details",
        },
        {
          platform: "Facebook",
          format: "Static",
          hook: `The idea behind ${input.brandName}'s next move.`,
          caption: "Clear positioning, useful proof and a direct reason to engage—without unsupported claims or generic filler.",
          cta: "Learn more",
        },
      ],
    };
  }

  const result = await run(contentAgent, JSON.stringify({
    ...input,
    rules: [
      "Use the supplied brand context as the source of truth.",
      "Never invent proof points, product features, stock, pricing or policies.",
      "If a fact is not supplied, keep the copy general rather than guessing.",
    ],
  }));
  return result.finalOutput;
}

export async function draftInquiryReply(input: {
  message: string;
  verifiedFacts: string[];
  brandName: string;
  brandContext?: string;
}) {
  if (process.env.AI_MODE !== "live" || !process.env.OPENAI_API_KEY) {
    const stockQuestion = /stock|available|medium|size|dress|inventory/i.test(input.message);
    return {
      reply: stockQuestion
        ? `I can help with that for ${input.brandName}. I need to verify the exact item and availability before confirming it. Please share the product name or link.`
        : `Thanks for reaching out to ${input.brandName}. I can help with this and will only confirm details that are verified for your request.`,
      intent: stockQuestion ? ("high" as const) : ("medium" as const),
      requiresHuman: false,
      missingFacts: stockQuestion ? ["Exact product identifier", "Live inventory for requested item"] : [],
    };
  }

  const result = await run(inquiryAgent, JSON.stringify({
    ...input,
    rules: [
      "Use the supplied brand context for tone and terminology.",
      "Verified facts in this request override general brand context.",
      "Never invent stock, delivery, discounts, refunds, pricing or exclusivity.",
    ],
  }));
  return result.finalOutput;
}

function mockStrategy(input: StrategyInput) {
  const budget = Math.max(0, input.budget);
  const offer = input.product?.trim() || "the primary offer";

  return {
    objective: input.objective,
    audienceSegments: [
      "High-intent prospects matching the core customer profile",
      "Engaged social users and video viewers",
      "Website visitors and product/service viewers for retargeting",
      "Existing customers or warm contacts for repeat demand and cross-sell",
    ],
    channelMix: [
      { channel: "Meta prospecting", budgetPct: 40 },
      { channel: "Meta retargeting", budgetPct: 20 },
      { channel: "Google Search", budgetPct: 20 },
      { channel: "Creator / content testing", budgetPct: 10 },
      { channel: "Creative testing reserve", budgetPct: 10 },
    ].map((item) => ({ ...item, estimatedAmount: Math.round((budget * item.budgetPct) / 100) })),
    creativeAngles: [
      `${offer}: core customer problem and desired outcome`,
      `${input.brandName} differentiation supported by verified proof`,
      "Objection handling and trust-building",
      "Product/service demonstration, use case or customer experience",
    ],
    kpis: [
      "CPA / cost per qualified lead or sale",
      "ROAS or revenue efficiency where attribution is reliable",
      "Landing-page conversion rate",
      "CTR by creative angle",
      "Lead-to-sale or visit-to-purchase rate",
    ],
    testPlan: [
      "Test materially different creative hooks before declaring an audience weak.",
      "Keep prospecting and retargeting budgets separated so efficiency is measurable.",
      "Review post-click conversion before reacting to strong CTR with weak sales.",
      "Scale winning campaigns gradually and keep spend changes approval-gated.",
    ],
    risks: [
      "Small sample sizes can create false winners.",
      "Creative fatigue can make retargeting look structurally weak.",
      "Revenue attribution may differ across platforms.",
    ],
    assumptions: [
      "No verified historical performance data was supplied to this mock planner.",
      "Budget allocation is a starting hypothesis, not a guaranteed outcome.",
      "Brand claims must come from the saved Brand Profile or verified campaign brief.",
    ],
  };
}
