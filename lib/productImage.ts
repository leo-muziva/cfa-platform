// Turns a stored filename like "EF105-1.jpg" into a URL the browser can load.
// The images live in the project's public folder, so they travel with the
// code — everyone on the team gets them when they pull.
// Returns null when a product has no image, so pages show a placeholder.
export function productImageUrl(imagePath: string | null): string | null {
  if (!imagePath) {
    return null;
  }
  return "/product-images/" + imagePath;
}