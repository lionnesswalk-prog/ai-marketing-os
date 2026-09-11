import type { AppSession } from "./auth";
import { canManageMarketing } from "./auth";
import { getPrisma } from "./prisma";
import { recordAuditEvent } from "./audit";

export type BrandProfile = {
  brandId: string;
  name: string;
  website: string;
  industry: string;
  audience: string;
  positioning: string;
  voice: string;
  proofPoints: string;
  avoid: string;
  notes: string;
};

export type BrandProfileInput = Omit<BrandProfile, "brandId">;

function databaseReady() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function listText(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join("\n");
  }
  return textValue(value);
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function profileFromBrand(brand: { id: string; name: string; voiceJson: unknown }): BrandProfile {
  const meta = jsonObject(brand.voiceJson);
  const personality = Array.isArray(meta.personality)
    ? meta.personality.filter((item): item is string => typeof item === "string").join(", ")
    : "";

  return {
    brandId: brand.id,
    name: brand.name,
    website: textValue(meta.website),
    industry: textValue(meta.industry),
    audience: textValue(meta.audience),
    positioning: textValue(meta.positioning),
    voice: textValue(meta.voice) || personality,
    proofPoints: listText(meta.proofPoints),
    avoid: listText(meta.avoid),
    notes: textValue(meta.notes),
  };
}

export async function getCurrentBrandProfile(session: AppSession): Promise<BrandProfile> {
  if (!databaseReady()) {
    return {
      brandId: "preview_brand",
      name: process.env.DEFAULT_BRAND_NAME || "Your Brand",
      website: "",
      industry: "",
      audience: "",
      positioning: "",
      voice: "Clear, specific, credible and consistent with the brand.",
      proofPoints: "",
      avoid: "Unsupported claims\nFake urgency\nInvented product facts",
      notes: "",
    };
  }

  const brand = await getPrisma().brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, voiceJson: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return profileFromBrand(brand);
}

export function buildBrandAIContext(profile: BrandProfile) {
  return [
    `Brand: ${profile.name}`,
    profile.website ? `Website: ${profile.website}` : "",
    profile.industry ? `Industry/category: ${profile.industry}` : "",
    profile.audience ? `Core audience: ${profile.audience}` : "",
    profile.positioning ? `Positioning: ${profile.positioning}` : "",
    profile.voice ? `Voice: ${profile.voice}` : "",
    profile.proofPoints ? `Verified proof points:\n${profile.proofPoints}` : "",
    profile.avoid ? `Avoid:\n${profile.avoid}` : "",
    profile.notes ? `Additional context: ${profile.notes}` : "",
  ].filter(Boolean).join("\n\n");
}

export async function updateBrandProfile(session: AppSession, input: BrandProfileInput) {
  if (!canManageMarketing(session.role)) throw new Error("BRAND_PROFILE_FORBIDDEN");
  if (!databaseReady()) throw new Error("DATABASE_MODE_REQUIRED");

  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");

  const existing = jsonObject(brand.voiceJson);
  const name = input.name.trim();
  const voice = input.voice.trim();
  const nextVoiceJson = {
    ...existing,
    website: input.website.trim(),
    industry: input.industry.trim(),
    audience: input.audience.trim(),
    positioning: input.positioning.trim(),
    voice,
    personality: voice
      ? voice.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 12)
      : [],
    proofPoints: splitLines(input.proofPoints),
    avoid: splitLines(input.avoid),
    notes: input.notes.trim(),
    updatedAt: new Date().toISOString(),
  };

  const updated = await prisma.brand.update({
    where: { id: brand.id },
    data: {
      name,
      voiceJson: nextVoiceJson as any,
    },
    select: { id: true, name: true, voiceJson: true },
  });

  await recordAuditEvent({
    workspaceId: session.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "brand_profile_updated",
    entityType: "Brand",
    entityId: brand.id,
    payload: {
      brandName: name,
      industry: input.industry.trim(),
    },
  });

  return profileFromBrand(updated);
}
