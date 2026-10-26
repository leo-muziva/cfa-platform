// Product photos come from two places:
// - Photos that shipped with the code live in the public folder and are
//   stored as a bare filename like "EF105-1.jpg".
// - Photos an admin uploads live in Supabase Storage and are stored with the
//   bucket in front, like "product-photos/12/3f2a....jpg".
export const PRODUCT_PHOTO_BUCKET = "product-photos";

const UPLOADED_PREFIX = PRODUCT_PHOTO_BUCKET + "/";

export function isUploadedProductPhoto(imagePath: string): boolean {
  return imagePath.startsWith(UPLOADED_PREFIX);
}

// The object's path inside the bucket, or null for a shipped photo.
export function uploadedPhotoObjectPath(imagePath: string | null): string | null {
  if (!imagePath || !isUploadedProductPhoto(imagePath)) return null;
  return imagePath.slice(UPLOADED_PREFIX.length);
}

// Turns a stored image path into a URL the browser can load.
// Returns null when a product has no image, so pages show a placeholder.
export function productImageUrl(
  imagePath: string | null,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!imagePath) {
    return null;
  }
  if (isUploadedProductPhoto(imagePath)) {
    if (!supabaseUrl) return null;
    return supabaseUrl.replace(/\/+$/, "") + "/storage/v1/object/public/" + imagePath;
  }
  return "/product-images/" + imagePath;
}
