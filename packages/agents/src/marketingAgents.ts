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

export const brandPostSchema = z.object({
  platform: z.enum(["instagram", "facebook", "pinterest"]),
  headline: z.string().max(80),
  subheadline: z.string().max(160),
  caption: z.string().max(2200),
  cta: z.string().max(80),
  hashtags: z.array(z.string().max(50)).max(12),
  visualDirection: z.string().max(500),
  postingWindow: z.enum(["morning", "midday", "evening"]),
  suggestedDayOffset: z.number().int().min(0).max(6),
  timingReason: z.string().max(400),
});

export const contentCalendarSchema = z.object({
  summary: z.string().max(500),
  entries: z.array(z.object({
    dayOffset: z.number().int().min(0).max(29),
    platform: z.enum(["instagram", "facebook", "pinterest"]),
    theme: z.string().max(160),
    headline: z.string().max(80),
    subheadline: z.string().max(160),
    caption: z.string().max(2200),
    cta: z.string().max(80),
    hashtags: z.array(z.string().max(50)).max(12),
    visualDirection: z.string().max(500),
  })).min(1).max(16),
});

export const strategistAgent = new Agent({
  name: "Marketing Strategist",
  instructions: `You are a senior performance marketing strategist. Build measurable campaign plans from brand, budget, product, audience and historic performance data. Never invent historical results. Separate assumptions from evidence. Budget percentages must add to 100. Treat financial outcomes as targets or hypotheses, never guarantees. Never invent numeric industry benchmarks or market statistics. Use verified workspace knowledge as factual source-of-truth, keep reference notes explicitly unverified, and adapt funnel logic to the supplied industry, market and business model.`,
  outputType: campaignPlanSchema,
});

export const optimizerAgent = new Agent({
  name: "Campaign Optimizer",
  instructions: `Diagnose campaign performance using funnel metrics. Distinguish creative, audience, bidding, landing page and checkout issues. Prefer experiments over large abrupt changes. Any recommendation that can change spend must be marked for human approval unless an explicit policy authorizes it. Never claim causation when the evidence is only correlational.`,
});

export const contentAgent = new Agent({
  name: "Social Content Manager",
  instructions: `Create social content aligned to the supplied brand voice, campaign objective and channel. Produce specific hooks, captions, reel concepts and carousel ideas. Avoid generic filler, unsupported claims, fake scarcity and invented product facts. Never invent numeric performance benchmarks or market statistics. Use verified workspace knowledge as factual source-of-truth.`,
  outputType: contentPlanSchema,
});

export const brandPostAgent = new Agent({
  name: "Brand Creative Director",
  instructions: `Create one premium static social-post concept for Instagram, Facebook or Pinterest using the supplied brand profile, visual identity, objective and workspace knowledge. Write a short design headline, supporting line, caption, CTA and hashtags. Recommend a posting window and day offset as a practical hypothesis, never as a guaranteed best time. Do not invent product facts, offers, prices, stock, proof or performance. Keep visualDirection specific enough for a designer, but the final visual will be rendered by the Brand Studio using the saved logo and colors.`,
  outputType: brandPostSchema,
});

export const contentCalendarAgent = new Agent({
  name: "AI Content Calendar Planner",
  instructions: `Build a practical static-content calendar for Instagram, Facebook and Pinterest using the supplied Brand Profile, verified Workspace Knowledge and posting-timing evidence. Produce exactly the requested number of entries spread across the requested horizon. Vary content themes and funnel jobs rather than repeating the same idea. Never invent products, offers, stock, prices, policies, proof or performance. Timing evidence is supplied separately; do not claim a time is proven unless the input explicitly marks it performance-based. When verified content-learning examples are supplied, use them as directional evidence for themes and creative patterns while preserving experimentation and never treating correlation as causation. The server will apply final posting windows.`,
  outputType: contentCalendarSchema,
});

export const brandCopilotAgent = new Agent({
  name: "Brand Marketing Copilot",
  instructions: `You are the workspace's brand-aware marketing copilot. Answer questions about content, positioning, campaigns, channel planning, launches, audience, brand voice and marketing execution using the supplied Brand Profile and Workspace Knowledge Base as the primary source of truth. Clearly distinguish verified workspace facts from recommendations and hypotheses. Never invent stock, pricing, policies, customer proof, historical results, legal claims or performance benchmarks. When important information is missing, say what is missing and suggest the next useful action. Keep answers practical and concise unless the user asks for depth.`,
});

export const inquiryAgent = new Agent({
  name: "Inquiry & Lead Agent",
  instructions: `Handle marketing and product inquiries using only verified catalog, inventory, shipping and policy data supplied in the request or via tools. Never promise stock, delivery, discount, refund or exclusivity without verified data. If a required fact is missing, clearly say it needs verification and mark missingFacts. Use verified workspace knowledge as factual source-of-truth and never convert unverified notes into confirmed claims. Escalate complaints, payment disputes, high-value negotiations and ambiguous policy questions to a human.`,
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
