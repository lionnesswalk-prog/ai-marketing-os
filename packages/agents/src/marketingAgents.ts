import { Agent } from "@openai/agents";
import { z } from "zod";

export const campaignPlanSchema = z.object({
  objective: z.string(),
  audienceSegments: z.array(z.string()),
  channelMix: z.array(z.object({ channel: z.string(), budgetPct: z.number().min(0).max(100) })),
  creativeAngles: z.array(z.string()),
  kpis: z.array(z.string()),
  testPlan: z.array(z.string()),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export const contentPlanSchema = z.object({
  theme: z.string(),
  posts: z.array(
    z.object({
      platform: z.string(),
      format: z.string(),
      hook: z.string(),
      caption: z.string(),
      cta: z.string(),
    }),
  ),
});

export const inquiryReplySchema = z.object({
  reply: z.string(),
  intent: z.enum(["low", "medium", "high"]),
  requiresHuman: z.boolean(),
  missingFacts: z.array(z.string()),
});

export const strategistAgent = new Agent({
  name: "Marketing Strategist",
  instructions: `You are a senior performance marketing strategist. Build measurable campaign plans from brand, budget, product, audience and historic performance data. Never invent historical results. Separate assumptions from evidence. Budget percentages must add to 100. Treat financial outcomes as targets or hypotheses, never guarantees.`,
  outputType: campaignPlanSchema,
});

export const optimizerAgent = new Agent({
  name: "Campaign Optimizer",
  instructions: `Diagnose campaign performance using funnel metrics. Distinguish creative, audience, bidding, landing page and checkout issues. Prefer experiments over large abrupt changes. Any recommendation that can change spend must be marked for human approval unless an explicit policy authorizes it. Never claim causation when the evidence is only correlational.`,
});

export const contentAgent = new Agent({
  name: "Social Content Manager",
  instructions: `Create social content aligned to the supplied brand voice, campaign objective and channel. Produce specific hooks, captions, reel concepts and carousel ideas. Avoid generic filler, unsupported claims, fake scarcity and invented product facts.`,
  outputType: contentPlanSchema,
});

export const inquiryAgent = new Agent({
  name: "Inquiry & Lead Agent",
  instructions: `Handle marketing and product inquiries using only verified catalog, inventory, shipping and policy data supplied in the request or via tools. Never promise stock, delivery, discount, refund or exclusivity without verified data. If a required fact is missing, clearly say it needs verification and mark missingFacts. Escalate complaints, payment disputes, high-value negotiations and ambiguous policy questions to a human.`,
  outputType: inquiryReplySchema,
});

export const orchestratorAgent = new Agent({
  name: "Marketing Orchestrator",
  instructions: `Route work to the correct specialist: strategy, optimization, content or inquiry handling. Keep a clear audit trail of recommendations and never bypass approval gates for spend-impacting or customer-sensitive actions.`,
  tools: [
    strategistAgent.asTool({ toolName: "build_marketing_strategy", toolDescription: "Create campaign and channel strategy." }),
    optimizerAgent.asTool({ toolName: "diagnose_campaign", toolDescription: "Diagnose campaign performance problems and propose controlled optimizations." }),
    contentAgent.asTool({ toolName: "create_social_content", toolDescription: "Create social-media content and campaign creative concepts." }),
    inquiryAgent.asTool({ toolName: "handle_inquiry", toolDescription: "Handle or triage incoming marketing/product inquiries." }),
  ],
});
