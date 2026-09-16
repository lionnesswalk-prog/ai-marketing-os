import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { answerBrandCopilot, buildBrandPost } from "../packages/agents/src/runtime";
import { renderBrandCreativePng } from "../apps/web/lib/brand-studio";

const previousMode = process.env.AI_MODE;
const previousKey = process.env.OPENAI_API_KEY;

try {
  process.env.AI_MODE = "mock";
  delete process.env.OPENAI_API_KEY;

  const post = await buildBrandPost({
    brandName: "Example Brand",
    theme: "New collection",
    objective: "Build discovery",
    preferredPlatform: "instagram",
    brandContext: "Brand voice: composed and specific.",
  });
  assert.equal(post.mode, "mock");
  assert.equal(post.output.platform, "instagram");
  assert.ok(post.output.headline.length > 0);
  assert.ok(["morning", "midday", "evening"].includes(post.output.postingWindow));

  const pinterestPost = await buildBrandPost({
    brandName: "Example Brand",
    theme: "Moodboard story",
    objective: "Drive saves",
    preferredPlatform: "pinterest",
    brandContext: "Brand voice: composed and specific.",
  });
  assert.equal(pinterestPost.output.platform, "pinterest");

  const copilot = await answerBrandCopilot({
    question: "What should we post this week?",
    brandContext: "Brand: Example Brand",
  });
  assert.equal(copilot.mode, "mock");
  assert.ok(copilot.output.includes("saved brand context"));

  const png = await renderBrandCreativePng({
    brandName: "Example Brand",
    primaryColor: "#171817",
    secondaryColor: "#7267f0",
    headline: "A considered new chapter",
    subheadline: "Built for discovery, with clarity and restraint.",
    cta: "Discover more",
  });
  assert.ok(png.byteLength > 1000);
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);

  const actionRoute = await readFile("apps/web/app/api/social/posts/action/route.ts", "utf8");
  assert.ok(actionRoute.includes('action: z.literal("publish")'));
  assert.ok(actionRoute.includes("publishDraftSocialPostNow"));

  const studioPage = await readFile("apps/web/app/studio/page.tsx", "utf8");
  assert.ok(studioPage.includes("BrandStudio"));
  assert.ok(studioPage.includes("BrandCopilot"));

  const profile = await readFile("apps/web/lib/brand-profile.ts", "utf8");
  assert.ok(profile.includes("logoUrl"));
  assert.ok(profile.includes("primaryColor"));
  assert.ok(profile.includes("secondaryColor"));

  const studioLib = await readFile("apps/web/lib/brand-studio.ts", "utf8");
  assert.ok(studioLib.includes("updateBrandStudioDraft"));
  assert.ok(studioLib.includes("creativeToken = randomBytes(24)"));

  const studioUi = await readFile("apps/web/components/BrandStudio.tsx", "utf8");
  assert.ok(studioUi.includes('option value="pinterest"'));
  assert.ok(studioUi.includes("Save & refresh creative"));
  assert.ok(studioUi.includes("/api/integrations/pinterest/boards"));

  const schema = await readFile("prisma/schema.prisma", "utf8");
  assert.ok(schema.includes("model BrandCopilotMessage"));
  assert.ok(schema.includes("copilotMessages BrandCopilotMessage[]"));

  const copilotApi = await readFile("apps/web/app/api/brand-copilot/route.ts", "utf8");
  assert.ok(copilotApi.includes("saveBrandCopilotExchange"));
  assert.ok(copilotApi.includes("listBrandCopilotHistory"));
} finally {
  if (previousMode === undefined) delete process.env.AI_MODE;
  else process.env.AI_MODE = previousMode;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

console.log("Brand Studio tests passed");
