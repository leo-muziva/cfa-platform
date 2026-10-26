import { describe, expect, it } from "vitest";
import { productImageUrl, uploadedPhotoObjectPath } from "./productImage";

const SUPABASE = "https://example.supabase.co/";

describe("productImageUrl", () => {
  it("serves shipped photos from the public folder", () => {
    expect(productImageUrl("EF105-1.jpg", SUPABASE)).toBe("/product-images/EF105-1.jpg");
  });

  it("serves uploaded photos from the public storage bucket", () => {
    expect(productImageUrl("product-photos/12/abc.webp", SUPABASE)).toBe(
      "https://example.supabase.co/storage/v1/object/public/product-photos/12/abc.webp",
    );
  });

  it("shows the placeholder when there is no photo or no storage URL", () => {
    expect(productImageUrl(null, SUPABASE)).toBeNull();
    expect(productImageUrl("product-photos/12/abc.webp", undefined)).toBeNull();
  });
});

describe("uploadedPhotoObjectPath", () => {
  it("returns the path inside the bucket for uploaded photos only", () => {
    expect(uploadedPhotoObjectPath("product-photos/12/abc.jpg")).toBe("12/abc.jpg");
    expect(uploadedPhotoObjectPath("EF105-1.jpg")).toBeNull();
    expect(uploadedPhotoObjectPath(null)).toBeNull();
  });
});
