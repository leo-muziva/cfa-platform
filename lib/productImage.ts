// Turns a stored filename like "EF105.jpg" into a full image URL.
// Returns null when a product has no image, so pages can show a placeholder.
export function productImageUrl(imagePath: string | null): string | null {
  if (!imagePath) {
    return null;
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base + "/storage/v1/object/public/product-images/" + imagePath;
}