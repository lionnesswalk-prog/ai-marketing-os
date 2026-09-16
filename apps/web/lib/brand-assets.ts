import sharp, { type Metadata } from "sharp";
import type { AppSession } from "./auth";
import { getPrisma } from "./prisma";

export type BrandAssetSummary = {
  id: string;
  fileName: string;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: string;
};

async function currentBrand(session: AppSession) {
  const brand = await getPrisma().brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return brand;
}

function cleanFileName(value: string) {
  const base = value.split(/[\\/]/).pop() || "product-image";
  return base.replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 120) || "product-image";
}

export async function listBrandAssets(session: AppSession, take = 12): Promise<BrandAssetSummary[]> {
  const brand = await currentBrand(session);
  const rows = await getPrisma().brandAsset.findMany({
    where: { brandId: brand.id, kind: "product_image" },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(take, 30)),
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      width: true,
      height: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function saveBrandAsset(session: AppSession, file: File): Promise<BrandAssetSummary> {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) throw new Error("BRAND_ASSET_TYPE_NOT_ALLOWED");
  if (file.size <= 0 || file.size > 6 * 1024 * 1024) throw new Error("BRAND_ASSET_TOO_LARGE");

  const input = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new Error("BRAND_ASSET_INVALID_IMAGE");
  }

  if (!metadata.width || !metadata.height) throw new Error("BRAND_ASSET_INVALID_IMAGE");
  if (metadata.width * metadata.height > 60_000_000) throw new Error("BRAND_ASSET_TOO_LARGE");

  let normalized: Buffer;
  try {
    normalized = await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error("BRAND_ASSET_INVALID_IMAGE");
  }

  const normalizedMeta = await sharp(normalized).metadata();
  const brand = await currentBrand(session);
  const row = await getPrisma().brandAsset.create({
    data: {
      brandId: brand.id,
      kind: "product_image",
      fileName: cleanFileName(file.name),
      mimeType: "image/jpeg",
      width: normalizedMeta.width ?? null,
      height: normalizedMeta.height ?? null,
      data: Uint8Array.from(normalized),
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      width: true,
      height: true,
      createdAt: true,
    },
  });

  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getBrandAsset(session: AppSession, id: string) {
  const brand = await currentBrand(session);
  return getPrisma().brandAsset.findFirst({
    where: { id, brandId: brand.id },
  });
}

export async function getBrandAssetForWorkspace(workspaceId: string, id: string) {
  return getPrisma().brandAsset.findFirst({
    where: {
      id,
      brand: { is: { workspaceId } },
    },
  });
}
