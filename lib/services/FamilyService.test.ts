import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/MemberService", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/repositories/FamilyRepository", () => ({
  listFamilyChanges: vi.fn(), requestFamilyChange: vi.fn(),
  acceptFamilyTransfer: vi.fn(), reviewFamilyChange: vi.fn(),
}));
import { getCurrentProfile } from "@/lib/services/MemberService";
import * as repository from "@/lib/repositories/FamilyRepository";
import { getFamilyChanges, requestFamilyChange, acceptFamilyTransfer, reviewFamilyChange } from "./FamilyService";
import type { Profile } from "@/types/domain";

const requestId = "92000000-0000-4000-8000-000000000001";
describe("family responsibility service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: requestId, is_staff: false } as Profile);
    vi.mocked(repository.listFamilyChanges).mockResolvedValue([]);
  });
  it("never reads a staff queue for a non-staff account", async () => {
    expect(await getFamilyChanges(true)).toEqual({ error: "Forbidden" });
    expect(repository.listFamilyChanges).not.toHaveBeenCalled();
  });
  it("keeps a staff member's personal requests household scoped", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: requestId, is_staff: true } as Profile);
    await getFamilyChanges();
    expect(repository.listFamilyChanges).toHaveBeenCalledWith(requestId, false);
  });
  it("rejects invalid transfer input before writing", async () => {
    expect(await requestFamilyChange({ linkId: requestId, kind: "transfer", reason: "Change payer" })).toHaveProperty("error");
    expect(repository.requestFamilyChange).not.toHaveBeenCalled();
  });
  it("requires authentication to accept a transfer", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null);
    expect(await acceptFamilyTransfer({ requestId, accept: true })).toEqual({ error: "Not authenticated" });
    expect(repository.acceptFamilyTransfer).not.toHaveBeenCalled();
  });
  it("does not allow dependents to review their own requests", async () => {
    expect(await reviewFamilyChange({ requestId, approve: true, note: "I approve" })).toEqual({ error: "Forbidden" });
    expect(repository.reviewFamilyChange).not.toHaveBeenCalled();
  });
  it("reports an RPC rejection without claiming approval", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: requestId, is_staff: true } as Profile);
    vi.mocked(repository.reviewFamilyChange).mockResolvedValue({ error: { message: "private database detail" } } as Awaited<ReturnType<typeof repository.reviewFamilyChange>>);
    const result = await reviewFamilyChange({ requestId, approve: true, note: "Verified transfer" });
    expect(result).toHaveProperty("error");
    expect(JSON.stringify(result)).not.toContain("private database detail");
    expect(result).not.toHaveProperty("success");
  });
  it("confirms an unlink without mentioning a new payer", async () => {
    vi.mocked(repository.requestFamilyChange).mockResolvedValue({ error: null } as Awaited<ReturnType<typeof repository.requestFamilyChange>>);
    const result = await requestFamilyChange({ linkId: requestId, kind: "unlink", reason: "I am an adult now" });
    expect(result).toEqual({ success: expect.stringContaining("Unlink requested") });
    expect(JSON.stringify(result)).not.toContain("new payer");
  });
  it("tells a transfer requester the new payer must accept first", async () => {
    vi.mocked(repository.requestFamilyChange).mockResolvedValue({ error: null } as Awaited<ReturnType<typeof repository.requestFamilyChange>>);
    const result = await requestFamilyChange({ linkId: requestId, kind: "transfer", newPayerEmail: "new@cfa.test", reason: "Moving house" });
    expect(result).toEqual({ success: expect.stringContaining("new payer must accept") });
  });
});
