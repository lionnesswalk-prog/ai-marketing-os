import type { AppSession } from "./auth";
import { canManageMarketing } from "./auth";
import { getPrisma } from "./prisma";

export type KnowledgeItemInput = {
  title: string;
  kind: string;
  content: string;
  sourceUrl?: string;
  verified: boolean;
};

async function currentBrandId(session: AppSession) {
  const brand = await getPrisma().brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return brand.id;
}

export async function listKnowledgeItems(session: AppSession) {
  const brandId = await currentBrandId(session);
  return getPrisma().knowledgeItem.findMany({
    where: { brandId },
    orderBy: [{ verified: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
}

export async function addKnowledgeItem(session: AppSession, input: KnowledgeItemInput) {
  if (!canManageMarketing(session.role)) throw new Error("KNOWLEDGE_FORBIDDEN");
  const brandId = await currentBrandId(session);
  const verified = Boolean(input.verified);
  return getPrisma().knowledgeItem.create({
    data: {
      brandId,
      title: input.title.trim(),
      kind: input.kind.trim() || "reference",
      content: input.content.trim(),
      sourceUrl: input.sourceUrl?.trim() || null,
      verified,
      verifiedAt: verified ? new Date() : null,
    },
  });
}

export async function removeKnowledgeItem(session: AppSession, id: string) {
  if (!canManageMarketing(session.role)) throw new Error("KNOWLEDGE_FORBIDDEN");
  const brandId = await currentBrandId(session);
  const item = await getPrisma().knowledgeItem.findFirst({ where: { id, brandId }, select: { id: true } });
  if (!item) throw new Error("KNOWLEDGE_NOT_FOUND");
  await getPrisma().knowledgeItem.delete({ where: { id } });
}

function clip(value: string, max = 1600) {
  return value.length <= max ? value : value.slice(0, max) + "…";
}

export async function buildWorkspaceKnowledgeContext(session: AppSession) {
  const items = await listKnowledgeItems(session);
  if (!items.length) {
    return [
      "WORKSPACE KNOWLEDGE BASE",
      "No saved workspace knowledge is available yet.",
      "Accuracy rule: do not invent product facts, pricing, stock, policies, customer proof or historical performance. Ask for verified data when needed.",
    ].join("\n");
  }

  const selected = items.slice(0, 30);
  const verified = selected.filter((item) => item.verified);
  const reference = selected.filter((item) => !item.verified);

  const lines: string[] = ["WORKSPACE KNOWLEDGE BASE"];
  if (verified.length) {
    lines.push("VERIFIED FACTS — may be used as factual workspace context:");
    for (const item of verified) {
      lines.push(
        `- [${item.kind}] ${item.title}: ${clip(item.content)}${item.sourceUrl ? ` | Source: ${item.sourceUrl}` : ""}`
      );
    }
  }
  if (reference.length) {
    lines.push("REFERENCE NOTES — useful context but must not be presented as independently verified facts:");
    for (const item of reference) {
      lines.push(
        `- [${item.kind}] ${item.title}: ${clip(item.content)}${item.sourceUrl ? ` | Source: ${item.sourceUrl}` : ""}`
      );
    }
  }
  lines.push("Accuracy rule: when workspace knowledge conflicts with general model knowledge, prefer the verified workspace fact for this brand. Never infer missing stock, prices, policies, proof, performance or legal claims.");
  return lines.join("\n");
}
