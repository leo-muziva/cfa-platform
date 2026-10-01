import "server-only";
import { validationFailure } from "@/lib/validations/form-errors";
import { getCurrentProfile } from "@/lib/services/MemberService";
import * as repository from "@/lib/repositories/FamilyRepository";
import { familyChangeSchema, familyAcceptanceSchema, familyReviewSchema } from "@/lib/validations/family.schema";

export async function getFamilyChanges(staffScope = false) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" } as const;
  if (staffScope && !profile.is_staff) return { error: "Forbidden" } as const;
  return { profile, requests: await repository.listFamilyChanges(profile.id, staffScope) };
}
export async function requestFamilyChange(raw: unknown) {
  const parsed = familyChangeSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error);
  if (!await getCurrentProfile()) return { error: "Not authenticated" };
  const { error } = await repository.requestFamilyChange(parsed.data);
  return error ? { error: "Unable to request this change. Check the account details and any pending request." } : { success: "Change requested. Transfers need the new payer's acceptance before staff review." };
}
export async function acceptFamilyTransfer(raw: unknown) {
  const parsed = familyAcceptanceSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid transfer response" };
  if (!await getCurrentProfile()) return { error: "Not authenticated" };
  const { error } = await repository.acceptFamilyTransfer(parsed.data.requestId, parsed.data.accept);
  return error ? { error: "This transfer cannot be answered by your account." } : { success: parsed.data.accept ? "Accepted. Staff approval is still required." : "Transfer declined." };
}
export async function reviewFamilyChange(raw: unknown) {
  const parsed = familyReviewSchema.safeParse(raw);
  if (!parsed.success) return { error: "Enter a review note between 3 and 1000 characters." };
  const profile = await getCurrentProfile();
  if (!profile?.is_staff) return { error: "Forbidden" };
  const { error } = await repository.reviewFamilyChange(parsed.data.requestId, parsed.data.approve, parsed.data.note);
  return error ? { error: "Review failed. Approval requires an unchanged relationship, accepted eligible adult payer for transfers, and a verified adult for unlinking." } : { success: parsed.data.approve ? "Responsibility updated. Historical charges retain their original payer." : "Request rejected." };
}
