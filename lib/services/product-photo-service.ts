import "server-only";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/services/MemberService";
import { PRODUCT_PHOTO_BUCKET, uploadedPhotoObjectPath } from "@/lib/productImage";
import { productIdSchema, productPhotoSchema } from "@/lib/validations/product.schema";
import {
  getProductImagePath,
  removeProductPhotoFile,
  setProductImagePath,
  uploadProductPhotoFile,
} from "@/lib/repositories/product-photo-repository";

export type ProductPhotoResult = { ok: true } | { ok: false; error: string };

type ImageType = { contentType: string; extension: string };

// Reads the file's first bytes rather than trusting its name or the type the
// browser sent, so a renamed file can't slip through as a photo.
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, i) => bytes[offset + i] === byte);
  if (starts([0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", extension: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  // "RIFF" then four size bytes then "WEBP".
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

// Uploads a new photo and points the product at it. The old uploaded photo is
// removed only after the product points at the new one, so the shop never
// shows a broken image.
export async function replaceProductPhoto(productId: number, file: unknown): Promise<ProductPhotoResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { ok: false, error: "Only admins can do that." };

  if (!productIdSchema.safeParse(productId).success) return { ok: false, error: "Invalid product." };
  const parsed = productPhotoSchema.safeParse(file);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Choose a photo to upload." };

  const bytes = new Uint8Array(await parsed.data.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "That file isn't a JPG, PNG or WebP image." };

  const current = await getProductImagePath(productId);
  if (!current.found) return { ok: false, error: "The product was not found." };

  // A fresh name each time, so browsers and the CDN never show a cached old photo.
  const objectPath = `${productId}/${randomUUID()}.${type.extension}`;
  if (!(await uploadProductPhotoFile(objectPath, bytes, type.contentType))) {
    return { ok: false, error: "Could not upload the photo. Try again." };
  }

  if (!(await setProductImagePath(productId, `${PRODUCT_PHOTO_BUCKET}/${objectPath}`))) {
    await removeProductPhotoFile(objectPath);
    return { ok: false, error: "Could not save the photo to the product." };
  }

  const previous = uploadedPhotoObjectPath(current.imagePath);
  if (previous) await removeProductPhotoFile(previous);
  return { ok: true };
}
