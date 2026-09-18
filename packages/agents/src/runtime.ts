import { run } from "@openai/agents";
import { brandCopilotAgent, brandPostAgent, contentAgent, contentCalendarAgent, inquiryAgent, strategistAgent } from "./marketingAgents";

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

export type BrandPostInput = {
  brandName: string;
  theme: string;
  objective: string;
  product?: string;
  preferredPlatform?: "instagram" | "facebook" | "pinterest";
  brandContext?: string;
};

export type BrandCopilotInput = {
  question: string;
  brandContext: string;
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ContentCalendarInput = {
  brandName: string;
  objective: string;
  focus?: string;
  horizonDays: 7 | 30;
  postCount: number;
  brandContext: string;
  timingContext: string;
  learningContext?: string;
};

export type AiExecutionMode = "live" | "mock" | "fallback";

export type AiExecutionResult<T> = {
  output: T;
  mode: AiExecutionMode;
  warning?: string;
};

function liveAiEnabled() {
  return process.env.AI_MODE === "live" && Boolean(process.env.OPENAI_API_KEY);
}

function fallbackWarning() {
  return "Live AI was temporarily unavailable, so a safe fallback was generated instead.";
}

export async function buildStrategy(input: StrategyInput) {
  if (!liveAiEnabled()) {
    return { output: mockStrategy(input), mode: "mock" as const };
  }

  try {
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
          "Use verified workspace knowledge as factual source-of-truth and label reference notes as unverified.",
          "Do not invent numeric industry benchmarks, market sizes, conversion rates, CAC, ROAS or growth rates. If a number is not supplied by verified context, describe the metric qualitatively or ask for data.",
          "Match funnel logic, KPIs and channel priorities to the supplied industry, market and business model.",
        ],
      }),
    );
    return { output: result.finalOutput, mode: "live" as const };
  } catch (error) {
    console.error("live AI strategy generation failed", error);
    return {
      output: mockStrategy(input),
      mode: "fallback" as const,
      warning: fallbackWarning(),
    };
  }
}

export async function buildContentPlan(input: ContentPlanInput) {
  if (!liveAiEnabled()) {
    return { output: mockContentPlan(input), mode: "mock" as const };
  }

  try {
    const result = await run(contentAgent, JSON.stringify({
      ...input,
      rules: [
        "Use the supplied brand context as the source of truth.",
        "Never invent proof points, product features, stock, pricing or policies.",
        "Use verified workspace knowledge as factual source-of-truth. Treat reference notes as unverified context.",
        "Do not invent performance benchmarks or market statistics.",
        "If a fact is not supplied, keep the copy general rather than guessing.",
      ],
    }));
    return { output: result.finalOutput, mode: "live" as const };
  } catch (error) {
    console.error("live AI content generation failed", error);
    return {
      output: mockContentPlan(input),
      mode: "fallback" as const,
      warning: fallbackWarning(),
    };
  }
}

export async function draftInquiryReply(input: {
  message: string;
  verifiedFacts: string[];
  brandName: string;
  brandContext?: string;
}) {
  if (!liveAiEnabled()) {
    return { output: mockInquiryReply(input), mode: "mock" as const };
  }

  try {
    const result = await run(inquiryAgent, JSON.stringify({
      ...input,
      rules: [
        "Use the supplied brand context for tone and terminology.",
        "Verified facts in this request override general brand context.",
        "Never invent stock, delivery, discounts, refunds, pricing or exclusivity.",
        "Use verified workspace knowledge as factual source-of-truth and say when required facts are missing.",
      ],
    }));
    return { output: result.finalOutput, mode: "live" as const };
  } catch (error) {
    console.error("live AI inquiry drafting failed", error);
    return {
      output: mockInquiryReply(input),
      mode: "fallback" as const,
      warning: fallbackWarning(),
    };
  }
}


export async function buildBrandPost(input: BrandPostInput) {
  if (!liveAiEnabled()) {
    return { output: mockBrandPost(input), mode: "mock" as const };
  }

  try {
    const result = await run(brandPostAgent, JSON.stringify({
      task: "Create one ready-to-render branded static social post.",
      ...input,
      rules: [
        "Use saved brand context and verified workspace knowledge as source-of-truth.",
        "If preferredPlatform is supplied, use it.",
        "Keep headline concise enough for a square creative.",
        "Timing is a recommendation hypothesis, not a guarantee.",
        "Do not invent facts, offers, prices, stock, policies, proof or performance.",
      ],
    }));
    return { output: result.finalOutput, mode: "live" as const };
  } catch (error) {
    console.error("live AI brand post generation failed", error);
    return {
      output: mockBrandPost(input),
      mode: "fallback" as const,
      warning: fallbackWarning(),
    };
  }
}

export async function buildContentCalendar(input: ContentCalendarInput) {
  const fallback = mockContentCalendar(input);
  if (!liveAiEnabled()) {
    return { output: fallback, mode: "mock" as const };
  }

  try {
    const result = await run(contentCalendarAgent, JSON.stringify({
      task: "Build a ready-to-materialize social content calendar.",
      ...input,
      rules: [
        `Return exactly ${input.postCount} entries across day offsets 0 through ${input.horizonDays - 1}.`,
        "Use only Instagram, Facebook and Pinterest because these are the current Brand Studio static-publishing destinations.",
        "Use verified workspace knowledge as factual source-of-truth.",
        "Treat supplied performance timing as recent correlation, never causation or a guarantee.",
        "Treat test timing as an experiment, never as historical evidence.",
        "Use supplied content-learning examples only as directional recent evidence. Do not copy old wording, do not overfit sparse samples, and preserve deliberate experimentation.",
        "Never compare raw engagement totals across platforms as if the scales were equivalent.",
        "Do not invent prices, offers, inventory, customer proof, policies or historical metrics.",
        "Keep each entry different enough to serve a distinct content purpose.",
      ],
    }));
    const output = result.finalOutput;
    if (!output || output.entries.length !== input.postCount) {
      throw new Error("CONTENT_CALENDAR_ENTRY_COUNT_MISMATCH");
    }
    return { output, mode: "live" as const };
  } catch (error) {
    console.error("live content calendar generation failed", error);
    return { output: fallback, mode: "fallback" as const, warning: fallbackWarning() };
  }
}

export async function answerBrandCopilot(input: BrandCopilotInput) {
  const fallback = mockBrandCopilot(input);
  if (!liveAiEnabled()) {
    return { output: fallback, mode: "mock" as const };
  }

  try {
    const result = await run(brandCopilotAgent, JSON.stringify({
      task: "Answer the user's brand/marketing question.",
      question: input.question,
      recentMessages: (input.recentMessages || []).slice(-10),
      brandContext: input.brandContext,
      rules: [
        "Use verified workspace knowledge as factual source-of-truth.",
        "Separate facts, recommendations and assumptions.",
        "Do not fabricate performance benchmarks or business facts.",
        "Give practical next actions when useful.",
      ],
    }));
    return { output: String(result.finalOutput || ""), mode: "live" as const };
  } catch (error) {
    console.error("live Brand Copilot failed", error);
    return { output: fallback, mode: "fallback" as const, warning: fallbackWarning() };
  }
}

function mockContentCalendar(input: ContentCalendarInput) {
  const platforms = ["instagram", "facebook", "pinterest"] as const;
  const themes = [
    "Brand point of view",
    "Product or service focus",
    "Education and useful context",
    "Behind the brand",
    "Audience question or objection",
    "Detail and craftsmanship",
    "Discovery story",
    "Trust-building context",
    "Use case",
    "Brand philosophy",
    "Conversation starter",
    "Next-step invitation",
  ];
  const count = Math.max(1, Math.min(input.postCount, 16));
  const step = input.horizonDays / count;

  return {
    summary: `A ${input.horizonDays}-day working content plan for ${input.brandName}, designed around ${input.objective.toLowerCase()}.`,
    entries: Array.from({ length: count }, (_, index) => {
      const platform = platforms[index % platforms.length];
      const theme = themes[index % themes.length] + (input.focus ? `: ${input.focus}` : "");
      return {
        dayOffset: Math.min(input.horizonDays - 1, Math.floor(index * step)),
        platform,
        theme,
        headline: theme.slice(0, 72),
        subheadline: `A focused ${platform} story supporting ${input.objective.toLowerCase()}.`.slice(0, 150),
        caption: `${input.brandName}: ${theme}. This is a working content direction grounded in the saved brand context, without unsupported claims.`,
        cta: "Discover more",
        hashtags: [input.brandName.replace(/[^a-z0-9]/gi, ""), "brandstory", "discovermore"]
          .filter(Boolean)
          .map((tag) => `#${tag}`),
        visualDirection: "Use saved brand colors, clear logo breathing room, disciplined typography and a distinct composition from adjacent calendar posts.",
      };
    }),
  };
}

function mockBrandPost(input: BrandPostInput) {
  const platform = input.preferredPlatform || "instagram";
  const theme = input.theme.trim();
  return {
    platform,
    headline: theme.slice(0, 64) || input.brandName,
    subheadline: input.objective.trim().slice(0, 120) || "A focused brand story built for the right audience.",
    caption: `${input.brandName}: ${theme}. A considered story designed to support ${input.objective.toLowerCase()} without unsupported claims.`,
    cta: "Discover more",
    hashtags: [input.brandName.replace(/[^a-z0-9]/gi, ""), "brandstory", "discovermore"].filter(Boolean).map((tag) => `#${tag}`),
    visualDirection: "Use the saved primary color as the main field, the secondary color as a restrained accent, generous negative space and the saved logo with clear breathing room.",
    postingWindow: "evening" as const,
    suggestedDayOffset: 1,
    timingReason: "Start with an evening test window and compare engagement against the brand's own future post history.",
  };
}

function mockBrandCopilot(input: BrandCopilotInput) {
  return [
    "Based on the saved brand context, I can help with this as a working recommendation.",
    `Question: ${input.question}`,
    "Use the Brand Profile and verified Knowledge items as the factual base. If this decision depends on product, pricing, inventory, policy or performance data that is not saved yet, add that information to Knowledge before treating the recommendation as final.",
  ].join("\n\n");
}

function mockContentPlan(input: ContentPlanInput) {
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

function mockInquiryReply(input: {
  message: string;
  verifiedFacts: string[];
  brandName: string;
  brandContext?: string;
}) {
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
