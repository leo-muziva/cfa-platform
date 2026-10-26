import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_PHOTO_BUCKET } from "@/lib/productImage";

// Product photo storage and the products.image_path pointer. Uses the
// signed-in admin's own client, so the products and storage policies from
// migrations 0029 and 0056 decide what is allowed.

export async function getProductImagePath(
  productId: number,
): Promise<{ found: false } | { found: true; imagePath: string | null }> {
  const db = await createClient();
  const { data, error } = await db
    .from("products")
    .select("image_path")
    .eq("id", productId)
    .maybeSingle();
  if (error || !data) return { found: false };
  return { found: true, imagePath: data.image_path };
}

export async function uploadProductPhotoFile(
  objectPath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const db = await createClient();
  const { error } = await db.storage
    .from(PRODUCT_PHOTO_BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: false });
  if (error) console.error("[product-photo] upload failed", { message: error.message });
  return !error;
}

// Returns false when no row changed, which is how RLS refusals show up.
export async function setProductImagePath(productId: number, imagePath: string): Promise<boolean> {
  const db = await createClient();
  const { data, error } = await db
    .from("products")
    .update({ image_path: imagePath })
    .eq("id", productId)
    .select("id");
  return !error && Boolean(data && data.length > 0);
}

// Best effort: a leftover file only costs storage, so failures are logged.
export async function removeProductPhotoFile(objectPath: string): Promise<void> {
  const db = await createClient();
  const { error } = await db.storage.from(PRODUCT_PHOTO_BUCKET).remove([objectPath]);
  if (error) console.error("[product-photo] remove failed", { message: error.message });
}
