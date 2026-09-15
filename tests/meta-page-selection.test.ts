import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const metaIntegration = await readFile("apps/web/lib/meta-integration.ts", "utf8");
const callbackRoute = await readFile("apps/web/app/api/integrations/meta/callback/route.ts", "utf8");
const selectRoute = await readFile("apps/web/app/api/integrations/meta/select/route.ts", "utf8");
const socialPage = await readFile("apps/web/app/social/page.tsx", "utf8");

assert.ok(metaIntegration.includes("savePendingMetaPages"), "Meta integration must persist pending page choices");
assert.ok(metaIntegration.includes("finalizePendingMetaPage"), "Meta integration must finalize a selected page");
assert.ok(metaIntegration.includes('provider: "meta_pending"'), "pending Meta choices must use workspace-scoped DB storage");
assert.ok(metaIntegration.includes("30 * 60_000"), "pending Meta choices must expire");
assert.ok(callbackRoute.includes("result.pages.length === 1"), "single-page Meta accounts may connect directly");
assert.ok(callbackRoute.includes("savePendingMetaPages"), "multi-page Meta accounts must require selection");
assert.equal(
  callbackRoute.includes("result.pages.find((page) => page.instagram_business_account) || result.pages[0]"),
  false,
  "callback must never silently pick a page from multiple choices",
);
assert.ok(selectRoute.includes("finalizePendingMetaPage"), "selection endpoint must finalize the chosen page");
assert.ok(socialPage.includes("META ACCOUNT SELECTION"), "Social Hub must render the Meta page chooser");
assert.ok(socialPage.includes('name="pageId"'), "Meta page chooser must submit an explicit page id");

console.log("Meta page selection tests passed");
