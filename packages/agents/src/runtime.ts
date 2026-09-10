import { run } from "@openai/agents";
import { contentAgent, inquiryAgent, strategistAgent } from "./marketingAgents";

export type StrategyInput = {
  brandName: string;
  budget: number;
  objective: string;
  product?: string;
  notes?: string;
};

export async function buildStrategy(input: StrategyInput) {
  if (process.env.AI_MODE !== "live" || !process.env.OPENAI_API_KEY) {
    return mockStrategy(input);
  }

  const result = await run(
    strategistAgent,
    JSON.stringify({
      task: "Build a practical 30-day marketing plan.",
      ...input,
      rules: [
        "Channel budget percentages must sum to 100.",
        "Do not fabricate historical performance.",
        "Mark assumptions explicitly.",
      ],
    }),
  );

  return result.finalOutput;
}

export async function buildContentPlan(input: { brandName: string; theme: string; objective: string; brandVoice: string }) {
  if (process.env.AI_MODE !== "live" || !process.env.OPENAI_API_KEY) {
    return {
      theme: input.theme,
      posts: [
        {
          platform: "Instagram",
          format: "Reel",
          hook: "A garment changes when she moves.",
          caption: "Designed with intention, finished with integrity, and made to belong to one story.",
          cta: "Discover the piece",
        },
        {
          platform: "Instagram",
          format: "Carousel",
          hook: "What makes a piece truly one-of-one?",
          caption: "A closer look at individuality, fabric choice and craftsmanship beyond what the eye sees.",
          cta: "Swipe to see the details",
        },
        {
          platform: "Facebook",
          format: "Static",
          hook: "Not more. More considered.",
          caption: "Luxury can be quieter: fewer pieces, stronger intention, and design that remains personal.",
          cta: "Explore Lioness Walk",
        },
      ],
    };
  }

  const result = await run(contentAgent, JSON.stringify(input));
  return result.finalOutput;
}

export async function draftInquiryReply(input: {
  message: string;
  verifiedFacts: string[];
  brandName: string;
}) {
  if (process.env.AI_MODE !== "live" || !process.env.OPENAI_API_KEY) {
    const stockQuestion = /stock|available|medium|size|dress/i.test(input.message);
    return {
      reply: stockQuestion
        ? "I can help with that. I need to verify the exact design and size availability before confirming it. Please share the product name or link."
        : "Thanks for reaching out. I can help with this and will only confirm details that are verified for your request.",
      intent: stockQuestion ? ("high" as const) : ("medium" as const),
      requiresHuman: false,
      missingFacts: stockQuestion ? ["Exact product identifier", "Live inventory for requested size"] : [],
    };
  }

  const result = await run(inquiryAgent, JSON.stringify(input));
  return result.finalOutput;
}

function mockStrategy(input: StrategyInput) {
  const budget = Math.max(0, input.budget);
  return {
    objective: input.objective,
    audienceSegments: [
      "High-intent prospects matching the core customer profile",
      "Engaged social users and video viewers",
      "Website visitors and product viewers for retargeting",
      "Past customers for cross-sell or new-collection discovery",
    ],
    channelMix: [
      { channel: "Meta prospecting", budgetPct: 45 },
      { channel: "Meta retargeting", budgetPct: 20 },
      { channel: "Google Search", budgetPct: 15 },
      { channel: "UGC / creator testing", budgetPct: 10 },
      { channel: "Creative testing reserve", budgetPct: 10 },
    ].map((item) => ({ ...item, estimatedAmount: Math.round((budget * item.budgetPct) / 100) })),
    creativeAngles: [
      "One-of-one exclusivity without loud scarcity language",
      "Garment movement and confidence",
      "Craftsmanship beyond visible details",
      "Fabric-led design and tactile quality",
    ],
    kpis: ["CPA / cost per qualified lead", "ROAS", "Landing-page conversion rate", "CTR by creative angle", "Lead-to-purchase rate"],
    testPlan: [
      "Test 3 materially different creative hooks before declaring an audience weak.",
      "Keep prospecting and retargeting budgets separated so efficiency is measurable.",
      "Review post-click conversion before reacting to good CTR with poor sales.",
      "Scale winning campaigns gradually and keep spend changes approval-gated.",
    ],
    risks: ["Small sample sizes can create false winners.", "Creative fatigue can make retargeting look structurally weak.", "Revenue attribution may differ across platforms."],
    assumptions: ["No verified historical campaign data was supplied to this mock planner.", "Budget allocation is a starting hypothesis, not a guaranteed outcome."],
  };
}
