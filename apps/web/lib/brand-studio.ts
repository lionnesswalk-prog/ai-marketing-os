import { randomBytes, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import type { AppSession } from "./auth";
import type { BrandProfile } from "./brand-profile";
import { canonicalAppOrigin } from "./app-origin";
import { fetchPublicMedia } from "./public-media";
import { getPrisma } from "./prisma";

export type BrandCreativeSpec = {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  headline: string;
  subheadline: string;
  cta: string;
  visualDirection?: string;
};

export type BrandPostDraftInput = {
  platform: "instagram" | "facebook";
  headline: string;
  subheadline: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualDirection: string;
  postingWindow: "morning" | "midday" | "evening";
  suggestedDayOffset: number;
  timingReason: string;
};

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeHex(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapLines(value: string, maxChars: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (next.length <= maxChars || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (usedWords < words.length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[.…]*$/, "") + "…";
  }
  return lines;
}

function readableInk(hex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const linear = (value: number) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.42 ? "#171817" : "#ffffff";
}

async function embeddedLogo(url?: string) {
  if (!url) return undefined;
  try {
    const response = await fetchPublicMedia(url, { cache: "no-store" });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return undefined;
    const declared = Number(response.headers.get("content-length") || "0");
    if (declared > 2 * 1024 * 1024) return undefined;
    const input = Buffer.from(await response.arrayBuffer());
    if (input.byteLength > 2 * 1024 * 1024) return undefined;
    const normalized = await sharp(input)
      .resize({ width: 230, height: 92, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return "data:image/png;base64," + normalized.toString("base64");
  } catch (error) {
    console.error("Brand Studio logo load failed", error);
    return undefined;
  }
}

export async function renderBrandCreativePng(spec: BrandCreativeSpec) {
  const primary = safeHex(spec.primaryColor, "#171817");
  const secondary = safeHex(spec.secondaryColor, "#7267f0");
  const ink = readableInk(primary);
  const mutedInk = ink === "#ffffff" ? "rgba(255,255,255,.76)" : "rgba(23,24,23,.68)";
  const logo = await embeddedLogo(spec.logoUrl);
  const headlineLines = wrapLines(spec.headline, 22, 3);
  const subheadlineLines = wrapLines(spec.subheadline, 42, 3);
  const headline = headlineLines.map((line, index) =>
    `<text x="82" y="${362 + index * 90}" fill="${ink}" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="700" letter-spacing="-2.4">${escapeXml(line)}</text>`
  ).join("");
  const subStart = 405 + headlineLines.length * 90;
  const subheadline = subheadlineLines.map((line, index) =>
    `<text x="86" y="${subStart + index * 42}" fill="${mutedInk}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="400">${escapeXml(line)}</text>`
  ).join("");
  const logoMarkup = logo
    ? `<rect x="76" y="66" width="270" height="126" rx="24" fill="rgba(255,255,255,.92)"/><image href="${logo}" x="96" y="82" width="230" height="92" preserveAspectRatio="xMinYMid meet"/>`
    : `<text x="82" y="130" fill="${ink}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="2">${escapeXml(spec.brandName.toUpperCase())}</text>`;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect width="1080" height="1080" fill="${primary}"/>
    <circle cx="930" cy="120" r="310" fill="${secondary}" opacity=".84"/>
    <circle cx="980" cy="980" r="250" fill="${secondary}" opacity=".24"/>
    <path d="M0 970 C260 900 460 1050 720 960 C865 910 950 900 1080 940 L1080 1080 L0 1080 Z" fill="${secondary}" opacity=".22"/>
    ${logoMarkup}
    <text x="84" y="266" fill="${mutedInk}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="5">BRAND STORY</text>
    ${headline}
    ${subheadline}
    <rect x="82" y="874" width="340" height="86" rx="43" fill="${ink}" opacity=".96"/>
    <text x="252" y="928" text-anchor="middle" fill="${primary}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">${escapeXml(spec.cta || "Discover more")}</text>
    <text x="84" y="1012" fill="${mutedInk}" font-family="Arial, Helvetica, sans-serif" font-size="18">${escapeXml(spec.brandName)}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function createBrandStudioDraft(input: {
  session: AppSession;
  profile: BrandProfile;
  post: BrandPostDraftInput;
  fallbackOrigin: string;
  aiMode: string;
  warning?: string;
}) {
  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({
    where: { id: input.profile.brandId, workspaceId: input.session.workspaceId },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");

  const creativeToken = randomBytes(24).toString("base64url");
  const creativeSpec: BrandCreativeSpec = {
    brandName: input.profile.name,
    logoUrl: input.profile.logoUrl || undefined,
    primaryColor: input.profile.primaryColor,
    secondaryColor: input.profile.secondaryColor,
    headline: input.post.headline,
    subheadline: input.post.subheadline,
    cta: input.post.cta,
    visualDirection: input.post.visualDirection,
  };

  const row = await prisma.socialPost.create({
    data: {
      brandId: brand.id,
      platform: input.post.platform,
      contentType: "static",
      title: input.post.headline,
      caption: input.post.caption,
      status: "draft",
      metadataJson: {
        hashtags: input.post.hashtags.join(" "),
        cta: input.post.cta,
        altText: [input.post.headline, input.post.subheadline].filter(Boolean).join(". "),
        creativeToken,
        creativeSpec,
        aiMode: input.aiMode,
        aiWarning: input.warning || null,
        postingWindow: input.post.postingWindow,
        suggestedDayOffset: input.post.suggestedDayOffset,
        timingReason: input.post.timingReason,
        generatedBy: "brand_studio",
        generatedAt: new Date().toISOString(),
      },
    },
  });

  const origin = canonicalAppOrigin(input.fallbackOrigin);
  const mediaUrl = new URL(
    `/api/public/brand-creative/${row.id}.${creativeToken}.png`,
    origin,
  ).toString();

  await prisma.socialPost.update({
    where: { id: row.id },
    data: {
      metadataJson: {
        ...jsonObject(row.metadataJson),
        mediaUrl,
      },
    },
  });

  return {
    postId: row.id,
    mediaUrl,
    platform: input.post.platform,
    title: input.post.headline,
    caption: input.post.caption,
    hashtags: input.post.hashtags.join(" "),
    cta: input.post.cta,
    postingWindow: input.post.postingWindow,
    suggestedDayOffset: input.post.suggestedDayOffset,
    timingReason: input.post.timingReason,
    visualDirection: input.post.visualDirection,
  };
}

export async function publicCreativeByToken(raw: string) {
  const match = raw.match(/^([^.]+)\.([A-Za-z0-9_-]+)\.png$/);
  if (!match) return null;
  const [, postId, suppliedToken] = match;

  const post = await getPrisma().socialPost.findUnique({
    where: { id: postId },
    include: { brand: { select: { name: true } } },
  });
  if (!post?.metadataJson || typeof post.metadataJson !== "object" || Array.isArray(post.metadataJson)) return null;
  const meta = post.metadataJson as Record<string, unknown>;
  const storedToken = typeof meta.creativeToken === "string" ? meta.creativeToken : "";
  if (!storedToken || storedToken.length !== suppliedToken.length) return null;
  if (!timingSafeEqual(Buffer.from(storedToken), Buffer.from(suppliedToken))) return null;

  const rawSpec = meta.creativeSpec;
  if (!rawSpec || typeof rawSpec !== "object" || Array.isArray(rawSpec)) return null;
  const value = rawSpec as Record<string, unknown>;
  const spec: BrandCreativeSpec = {
    brandName: typeof value.brandName === "string" ? value.brandName : post.brand.name,
    logoUrl: typeof value.logoUrl === "string" ? value.logoUrl : undefined,
    primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : "#171817",
    secondaryColor: typeof value.secondaryColor === "string" ? value.secondaryColor : "#7267f0",
    headline: typeof value.headline === "string" ? value.headline : post.title,
    subheadline: typeof value.subheadline === "string" ? value.subheadline : "",
    cta: typeof value.cta === "string" ? value.cta : "Discover more",
    visualDirection: typeof value.visualDirection === "string" ? value.visualDirection : undefined,
  };
  return renderBrandCreativePng(spec);
}
