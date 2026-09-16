import type { AppSession } from "./auth";
import { getPrisma } from "./prisma";

async function currentBrandId(session: AppSession) {
  const brand = await getPrisma().brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return brand.id;
}

export async function listBrandCopilotHistory(session: AppSession, take = 40) {
  const brandId = await currentBrandId(session);
  const rows = await getPrisma().brandCopilotMessage.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(take, 100)),
  });

  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" as const : "user" as const,
    content: row.content,
    mode: row.mode || undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function saveBrandCopilotExchange(input: {
  session: AppSession;
  question: string;
  answer: string;
  mode: string;
}) {
  const brandId = await currentBrandId(input.session);
  const prisma = getPrisma();

  await prisma.$transaction([
    prisma.brandCopilotMessage.create({
      data: {
        brandId,
        userId: input.session.userId,
        role: "user",
        content: input.question,
        mode: input.mode,
      },
    }),
    prisma.brandCopilotMessage.create({
      data: {
        brandId,
        userId: input.session.userId,
        role: "assistant",
        content: input.answer,
        mode: input.mode,
      },
    }),
  ]);
}
