import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/MemberService", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/repositories/product-photo-repository", () => ({
  getProductImagePath: vi.fn(),
  uploadProductPhotoFile: vi.fn(),
  setProductImagePath: vi.fn(),
  removeProductPhotoFile: vi.fn(),
}));

import { requireAdmin } from "@/lib/services/MemberService";
import * as repo from "@/lib/repositories/product-photo-repository";
import { detectImageType, replaceProductPhoto } from "./product-photo-service";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

function photo(bytes: number[], name = "mask.jpg", type = "image/jpeg") {
  return new File([new Uint8Array(bytes)], name, { type });
}

const admin = { profile: { id: "admin-1" } } as Awaited<ReturnType<typeof requireAdmin>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(admin);
  vi.mocked(repo.getProductImagePath).mockResolvedValue({ found: true, imagePath: "EF105-1.jpg" });
  vi.mocked(repo.uploadProductPhotoFile).mockResolvedValue(true);
  vi.mocked(repo.setProductImagePath).mockResolvedValue(true);
});

describe("detectImageType", () => {
  it("recognises JPG, PNG and WebP from their bytes", () => {
    expect(detectImageType(new Uint8Array(JPEG))?.extension).toBe("jpg");
    expect(detectImageType(new Uint8Array(PNG))?.extension).toBe("png");
    expect(detectImageType(new Uint8Array(WEBP))?.extension).toBe("webp");
  });

  it("rejects anything else, whatever its name says", () => {
    expect(detectImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("replaceProductPhoto", () => {
  it("uploads under the product id and points the product at the new photo", async () => {
    const result = await replaceProductPhoto(12, photo(JPEG));

    expect(result).toEqual({ ok: true });
    const [objectPath, , contentType] = vi.mocked(repo.uploadProductPhotoFile).mock.calls[0];
    expect(objectPath).toMatch(/^12\/[0-9a-f-]{36}\.jpg$/);
    expect(contentType).toBe("image/jpeg");
    expect(repo.setProductImagePath).toHaveBeenCalledWith(12, "product-photos/" + objectPath);
  });

  it("removes the old uploaded photo only after the switch, and never a shipped one", async () => {
    vi.mocked(repo.getProductImagePath).mockResolvedValue({ found: true, imagePath: "product-photos/12/old.png" });
    await replaceProductPhoto(12, photo(PNG, "new.png", "image/png"));
    expect(repo.removeProductPhotoFile).toHaveBeenCalledWith("12/old.png");

    vi.mocked(repo.removeProductPhotoFile).mockClear();
    vi.mocked(repo.getProductImagePath).mockResolvedValue({ found: true, imagePath: "EF105-1.jpg" });
    await replaceProductPhoto(12, photo(JPEG));
    expect(repo.removeProductPhotoFile).not.toHaveBeenCalled();
  });

  it("refuses anyone who is not an admin before touching storage", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ error: "Forbidden" });
    expect(await replaceProductPhoto(12, photo(JPEG))).toEqual({ ok: false, error: "Only admins can do that." });
    expect(repo.uploadProductPhotoFile).not.toHaveBeenCalled();
  });

  it("rejects missing, empty, oversized and disguised files", async () => {
    expect(await replaceProductPhoto(12, null)).toEqual({ ok: false, error: "Choose a photo to upload." });
    expect(await replaceProductPhoto(12, photo([]))).toEqual({ ok: false, error: "That photo is empty." });
    expect(await replaceProductPhoto(12, photo(new Array(4 * 1024 * 1024 + 1).fill(0xff)))).toEqual({
      ok: false,
      error: "Photos must be 4 MB or smaller.",
    });
    expect(await replaceProductPhoto(12, photo([0x25, 0x50, 0x44, 0x46], "mask.jpg"))).toEqual({
      ok: false,
      error: "That file isn't a JPG, PNG or WebP image.",
    });
    expect(await replaceProductPhoto(-1, photo(JPEG))).toEqual({ ok: false, error: "Invalid product." });
    expect(repo.uploadProductPhotoFile).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded file when the product can't be updated", async () => {
    vi.mocked(repo.setProductImagePath).mockResolvedValue(false);
    const result = await replaceProductPhoto(12, photo(JPEG));
    expect(result).toEqual({ ok: false, error: "Could not save the photo to the product." });
    const [objectPath] = vi.mocked(repo.uploadProductPhotoFile).mock.calls[0];
    expect(repo.removeProductPhotoFile).toHaveBeenCalledWith(objectPath);
  });

  it("does not upload for a product that doesn't exist", async () => {
    vi.mocked(repo.getProductImagePath).mockResolvedValue({ found: false });
    expect(await replaceProductPhoto(99, photo(JPEG))).toEqual({ ok: false, error: "The product was not found." });
    expect(repo.uploadProductPhotoFile).not.toHaveBeenCalled();
  });
});
