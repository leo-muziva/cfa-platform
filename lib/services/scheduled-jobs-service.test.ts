import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const expireLessonHolds = vi.fn();
const runScheduledInvoices = vi.fn();
vi.mock("@/lib/repositories/scheduled-jobs-repository", () => ({ expireLessonHolds, runScheduledInvoices }));

const { isAuthorizedCronRequest, releaseExpiredLessonHolds, runMonthlyInvoicesJob } = await import("./scheduled-jobs-service");

beforeEach(() => vi.clearAllMocks());

describe("cron authorization", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedCronRequest("Bearer wrong!", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("s3cret", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest(null, "s3cret")).toBe(false);
  });

  it("refuses every request when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
  });
});

describe("scheduled jobs", () => {
  it("never lets a failed hold release break the page", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expireLessonHolds.mockResolvedValue({ ok: false, error: "SUPABASE_SECRET_KEY is not configured" });
    await expect(releaseExpiredLessonHolds()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("returns the invoicing count", async () => {
    runScheduledInvoices.mockResolvedValue({ ok: true, count: 4 });
    await expect(runMonthlyInvoicesJob()).resolves.toEqual({ ok: true, count: 4 });
  });
});
