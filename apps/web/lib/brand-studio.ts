import { randomBytes, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import type { AppSession } from "./auth";
import type { BrandProfile } from "./brand-profile";
import { canonicalAppOrigin } from "./app-origin";
import { fetchPublicMedia } from "./public-media";
import { getPrisma } from "./prisma";

export type BrandCreativeTemplate = "editorial" | "split" | "minimal";

export type BrandCreativeSpec = {
  brandName: string;
  logoUrl?: string;
  assetId?: string;
  primaryColor: string;
  secondaryColor: string;
  headline: string;
  subheadline: string;
  cta: string;
  visualDirection?: string;
};

export type BrandPostDraftInput = {
  platform: "instagram" | "facebook" | "pinterest";
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

export async function renderBrandCreativePng(
  spec: BrandCreativeSpec,
  options?: { template?: BrandCreativeTemplate; productImage?: Uint8Array },
) {
  const template = options?.template || "editorial";
  const primary = safeHex(spec.primaryColor, "#171817");
  const secondary = safeHex(spec.secondaryColor, "#7267f0");
  const primaryInk = readableInk(primary);
  const logo = await embeddedLogo(spec.logoUrl);
  const product = options?.productImage?.byteLength
    ? "data:image/jpeg;base64," + Buffer.from(options.productImage).toString("base64")
    : undefined;

  const logoMarkup = (x: number, y: number, width = 230, height = 92, dark = false) =>
    logo
      ? `<rect x="${x - 18}" y="${y - 14}" width="${width + 36}" height="${height + 28}" rx="22" fill="rgba(255,255,255,.92)"/><image href="${logo}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMinYMid meet"/>`
      : `<text x="${x}" y="${y + 48}" fill="${dark ? "#171817" : "#ffffff"}" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" letter-spacing="2">${escapeXml(spec.brandName.toUpperCase())}</text>`;

  const lines = wrapLines(spec.headline, template === "split" ? 17 : 21, 3);
  const subLines = wrapLines(spec.subheadline, template === "split" ? 27 : 39, 3);

  let svg = "";

  if (template === "editorial") {
    const headline = lines.map((line, index) =>
      `<text x="78" y="${650 + index * 82}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="700" letter-spacing="-2.1">${escapeXml(line)}</text>`
    ).join("");
    const subStart = 684 + lines.length * 82;
    const sub = subLines.map((line, index) =>
      `<text x="82" y="${subStart + index * 38}" fill="rgba(255,255,255,.78)" font-family="Arial, Helvetica, sans-serif" font-size="27">${escapeXml(line)}</text>`
    ).join("");

    svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".08"/>
          <stop offset=".52" stop-color="#000" stop-opacity=".12"/>
          <stop offset="1" stop-color="#000" stop-opacity=".82"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="${primary}"/>
      ${product ? `<image href="${product}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice"/>` : `<circle cx="910" cy="120" r="360" fill="${secondary}" opacity=".8"/><circle cx="130" cy="900" r="300" fill="${secondary}" opacity=".22"/>`}
      <rect width="1080" height="1080" fill="url(#overlay)"/>
      ${logoMarkup(80, 74)}
      <text x="82" y="575" fill="rgba(255,255,255,.68)" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="5">EDITORIAL STORY</text>
      ${headline}
      ${sub}
      <rect x="78" y="930" width="318" height="82" rx="41" fill="#ffffff"/>
      <text x="237" y="982" text-anchor="middle" fill="#171817" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700">${escapeXml(spec.cta || "Discover more")}</text>
    </svg>`;
  } else if (template === "split") {
    const headline = lines.map((line, index) =>
      `<text x="620" y="${370 + index * 76}" fill="${primaryInk}" font-family="Arial, Helvetica, sans-serif" font-size="63" font-weight="700" letter-spacing="-2">${escapeXml(line)}</text>`
    ).join("");
    const subStart = 408 + lines.length * 76;
    const sub = subLines.map((line, index) =>
      `<text x="624" y="${subStart + index * 36}" fill="${primaryInk}" opacity=".68" font-family="Arial, Helvetica, sans-serif" font-size="25">${escapeXml(line)}</text>`
    ).join("");

    svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <rect width="1080" height="1080" fill="${primary}"/>
      <rect x="0" y="0" width="560" height="1080" fill="#f2f1ed"/>
      ${product ? `<image href="${product}" x="0" y="0" width="560" height="1080" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="54" y="80" width="452" height="920" rx="40" fill="${secondary}" opacity=".58"/>`}
      <rect x="560" y="0" width="10" height="1080" fill="${secondary}"/>
      ${logoMarkup(620, 78, 210, 84, primaryInk === "#171817")}
      <text x="622" y="294" fill="${primaryInk}" opacity=".56" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="5">BRAND EDIT</text>
      ${headline}
      ${sub}
      <rect x="620" y="875" width="310" height="80" rx="40" fill="${primaryInk}"/>
      <text x="775" y="926" text-anchor="middle" fill="${primary}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${escapeXml(spec.cta || "Discover more")}</text>
    </svg>`;
  } else {
    const headline = lines.map((line, index) =>
      `<text x="84" y="${792 + index * 70}" fill="${primaryInk}" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" letter-spacing="-1.8">${escapeXml(line)}</text>`
    ).join("");
    const subStart = 824 + lines.length * 70;
    const sub = subLines.slice(0, 2).map((line, index) =>
      `<text x="86" y="${subStart + index * 34}" fill="${primaryInk}" opacity=".64" font-family="Arial, Helvetica, sans-serif" font-size="23">${escapeXml(line)}</text>`
    ).join("");

    svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <rect width="1080" height="1080" fill="${primary}"/>
      <circle cx="970" cy="120" r="260" fill="${secondary}" opacity=".35"/>
      ${logoMarkup(76, 62, 205, 82, primaryInk === "#171817")}
      <rect x="78" y="190" width="924" height="520" rx="46" fill="#ffffff" opacity=".96"/>
      ${product ? `<clipPath id="productClip"><rect x="98" y="210" width="884" height="480" rx="32"/></clipPath><image href="${product}" x="98" y="210" width="884" height="480" preserveAspectRatio="xMidYMid slice" clip-path="url(#productClip)"/>` : `<rect x="98" y="210" width="884" height="480" rx="32" fill="${secondary}" opacity=".24"/>`}
      ${headline}
      ${sub}
      <text x="994" y="1010" text-anchor="end" fill="${primaryInk}" opacity=".58" font-family="Arial, Helvetica, sans-serif" font-size="18">${escapeXml(spec.cta || "Discover more")} →</text>
    </svg>`;
  }

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

function creativeVariantUrls(origin: string, postId: string, token: string) {
  return {
    editorial: new URL(`/api/public/brand-creative/${postId}.${token}.editorial.png`, origin).toString(),
    split: new URL(`/api/public/brand-creative/${postId}.${token}.split.png`, origin).toString(),
    minimal: new URL(`/api/public/brand-creative/${postId}.${token}.minimal.png`, origin).toString(),
  };
}

export async function createBrandStudioDraft(input: {
  session: AppSession;
  profile: BrandProfile;
  post: BrandPostDraftInput;
  fallbackOrigin: string;
  aiMode: string;
  warning?: string;
  assetId?: string;
  sourceCalendarPlanId?: string;
  sourceCalendarItemId?: string;
}) {
  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({
    where: { id: input.profile.brandId, workspaceId: input.session.workspaceId },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");

  if (input.assetId) {
    const asset = await prisma.brandAsset.findFirst({
      where: { id: input.assetId, brandId: brand.id, kind: "product_image" },
      select: { id: true },
    });
    if (!asset) throw new Error("BRAND_ASSET_NOT_FOUND");
  }

  const creativeToken = randomBytes(24).toString("base64url");
  const creativeSpec: BrandCreativeSpec = {
    brandName: input.profile.name,
    logoUrl: input.profile.logoUrl || undefined,
    assetId: input.assetId,
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
        creativeTemplate: "editorial",
        aiMode: input.aiMode,
        aiWarning: input.warning || null,
        postingWindow: input.post.postingWindow,
        suggestedDayOffset: input.post.suggestedDayOffset,
        timingReason: input.post.timingReason,
        generatedBy: "brand_studio",
        sourceCalendarPlanId: input.sourceCalendarPlanId || null,
        sourceCalendarItemId: input.sourceCalendarItemId || null,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  const origin = canonicalAppOrigin(input.fallbackOrigin);
  const variantUrls = creativeVariantUrls(origin, row.id, creativeToken);
  const mediaUrl = variantUrls.editorial;

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
    variantUrls,
    creativeTemplate: "editorial" as BrandCreativeTemplate,
    assetId: input.assetId,
    platform: input.post.platform,
    title: input.post.headline,
    subheadline: input.post.subheadline,
    caption: input.post.caption,
    hashtags: input.post.hashtags.join(" "),
    cta: input.post.cta,
    postingWindow: input.post.postingWindow,
    suggestedDayOffset: input.post.suggestedDayOffset,
    timingReason: input.post.timingReason,
    visualDirection: input.post.visualDirection,
  };
}

export async function updateBrandStudioDraft(input: {
  session: AppSession;
  postId: string;
  fallbackOrigin: string;
  headline: string;
  subheadline: string;
  caption: string;
  cta: string;
  hashtags: string;
  pinterestBoardId?: string;
  creativeTemplate?: BrandCreativeTemplate;
}) {
  const prisma = getPrisma();
  const post = await prisma.socialPost.findFirst({
    where: {
      id: input.postId,
      status: "draft",
      brand: { is: { workspaceId: input.session.workspaceId } },
    },
  });
  if (!post) throw new Error("BRAND_STUDIO_DRAFT_NOT_FOUND");
  if (!post.metadataJson || typeof post.metadataJson !== "object" || Array.isArray(post.metadataJson)) {
    throw new Error("BRAND_STUDIO_DRAFT_INVALID");
  }

  const meta = post.metadataJson as Record<string, unknown>;
  if (meta.generatedBy !== "brand_studio") throw new Error("BRAND_STUDIO_DRAFT_INVALID");
  const rawSpec = meta.creativeSpec;
  if (!rawSpec || typeof rawSpec !== "object" || Array.isArray(rawSpec)) {
    throw new Error("BRAND_STUDIO_DRAFT_INVALID");
  }

  const currentSpec = rawSpec as Record<string, unknown>;
  const creativeToken = randomBytes(24).toString("base64url");
  const creativeSpec: BrandCreativeSpec = {
    brandName: typeof currentSpec.brandName === "string" ? currentSpec.brandName : "",
    logoUrl: typeof currentSpec.logoUrl === "string" ? currentSpec.logoUrl : undefined,
    assetId: typeof currentSpec.assetId === "string" ? currentSpec.assetId : undefined,
    primaryColor: typeof currentSpec.primaryColor === "string" ? currentSpec.primaryColor : "#171817",
    secondaryColor: typeof currentSpec.secondaryColor === "string" ? currentSpec.secondaryColor : "#7267f0",
    headline: input.headline,
    subheadline: input.subheadline,
    cta: input.cta,
    visualDirection: typeof currentSpec.visualDirection === "string" ? currentSpec.visualDirection : undefined,
  };

  const origin = canonicalAppOrigin(input.fallbackOrigin);
  const variantUrls = creativeVariantUrls(origin, post.id, creativeToken);
  const creativeTemplate: BrandCreativeTemplate = input.creativeTemplate || "editorial";
  const mediaUrl = variantUrls[creativeTemplate];

  const updated = await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      title: input.headline,
      caption: input.caption,
      metadataJson: {
        ...meta,
        hashtags: input.hashtags,
        cta: input.cta,
        altText: [input.headline, input.subheadline].filter(Boolean).join(". "),
        creativeToken,
        creativeSpec,
        creativeTemplate,
        mediaUrl,
        ...(post.platform === "pinterest"
          ? { pinterestBoardId: input.pinterestBoardId || null }
          : {}),
        editedAt: new Date().toISOString(),
      },
    },
  });

  return {
    postId: updated.id,
    mediaUrl,
    variantUrls,
    creativeTemplate,
    assetId: creativeSpec.assetId,
    platform: updated.platform as "instagram" | "facebook" | "pinterest",
    title: updated.title,
    subheadline: input.subheadline,
    caption: updated.caption,
    hashtags: input.hashtags,
    cta: input.cta,
    pinterestBoardId: post.platform === "pinterest" ? input.pinterestBoardId : undefined,
  };
}

export async function publicCreativeByToken(raw: string) {
  const match = raw.match(/^([^.]+)\.([A-Za-z0-9_-]+)(?:\.(editorial|split|minimal))?\.png$/);
  if (!match) return null;
  const [, postId, suppliedToken, requestedTemplate] = match;

  const prisma = getPrisma();
  const post = await prisma.socialPost.findUnique({
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
    assetId: typeof value.assetId === "string" ? value.assetId : undefined,
    primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : "#171817",
    secondaryColor: typeof value.secondaryColor === "string" ? value.secondaryColor : "#7267f0",
    headline: typeof value.headline === "string" ? value.headline : post.title,
    subheadline: typeof value.subheadline === "string" ? value.subheadline : "",
    cta: typeof value.cta === "string" ? value.cta : "Discover more",
    visualDirection: typeof value.visualDirection === "string" ? value.visualDirection : undefined,
  };

  const storedTemplate = typeof meta.creativeTemplate === "string" ? meta.creativeTemplate : "editorial";
  const candidate = requestedTemplate || storedTemplate;
  const template: BrandCreativeTemplate =
    candidate === "split" || candidate === "minimal" ? candidate : "editorial";

  const asset = spec.assetId
    ? await prisma.brandAsset.findFirst({
        where: { id: spec.assetId, brandId: post.brandId, kind: "product_image" },
        select: { data: true },
      })
    : null;

  return renderBrandCreativePng(spec, {
    template,
    productImage: asset?.data,
  });
}
