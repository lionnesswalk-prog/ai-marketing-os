import assert from "node:assert/strict";
import { buildContentPlan, buildStrategy, draftInquiryReply } from "../packages/agents/src/runtime";

const previousMode = process.env.AI_MODE;
const previousKey = process.env.OPENAI_API_KEY;

try {
  process.env.AI_MODE = "mock";
  delete process.env.OPENAI_API_KEY;

  const strategy = await buildStrategy({
    brandName: "Test Brand",
    budget: 100000,
    objective: "Increase qualified demand",
  });
  assert.equal(strategy.mode, "mock");
  assert.ok(strategy.output);
  assert.ok(Array.isArray(strategy.output.channelMix));

  const content = await buildContentPlan({
    brandName: "Test Brand",
    theme: "Product story",
    objective: "Build discovery",
    brandVoice: "Clear and credible",
  });
  assert.equal(content.mode, "mock");
  assert.ok(content.output.posts.length > 0);

  const inquiry = await draftInquiryReply({
    brandName: "Test Brand",
    message: "Is size medium available?",
    verifiedFacts: [],
  });
  assert.equal(inquiry.mode, "mock");
  assert.ok(inquiry.output.reply.length > 0);
  assert.ok(inquiry.output.missingFacts.length > 0);
} finally {
  if (previousMode === undefined) delete process.env.AI_MODE;
  else process.env.AI_MODE = previousMode;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

console.log("AI runtime fallback tests passed");
