// Family rules: unlinking a dependent from their guardian, or transferring
// them to a new paying guardian. Every change is a request that staff must
// approve; the database RPCs enforce who may ask, accept and review.
import "server-only";
import { validationFailure } from "@/lib/validations/form-errors";
import { getCurrentProfile } from "@/lib/services/MemberService";
import * as repository from "@/lib/repositories/FamilyRepository";
import { familyChangeSchema, familyAcceptanceSchema, familyReviewSchema } from "@/lib/validations/family.schema";

/**
 * Lists family change requests. Members see only requests that involve
 * them; `staffScope` returns every request and is refused for non-staff.
 */
export async function getFamilyChanges(staffScope = false) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" } as const;
  if (staffScope && !profile.is_staff) return { error: "Forbidden" } as const;
  return { profile, requests: await repository.listFamilyChanges(profile.id, staffScope) };
}
/** Opens an unlink or transfer request for an existing guardian link. */
export async function requestFamilyChange(raw: unknown) {
  const parsed = familyChangeSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error);
  if (!await getCurrentProfile()) return { error: "Not authenticated" };
  const { error } = await repository.requestFamilyChange(parsed.data);
  return error ? { error: "Unable to request this change. Check the account details and any pending request." } : { success: requestedChangeMessage(parsed.data.kind) };
}
/** Explains to the requester what happens next for each request kind. */
export function requestedChangeMessage(kind: "unlink" | "transfer") {
  return kind === "unlink"
    ? "Unlink requested. Staff will review it, and the relationship stays active until they approve."
    : "Transfer requested. The new payer must accept it, then staff will review it.";
}
/**
 * Lets the proposed new payer accept or decline a transfer. Accepting does
 * not move the dependent yet; staff still have to approve.
 */
export async function acceptFamilyTransfer(raw: unknown) {
  const parsed = familyAcceptanceSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid transfer response" };
  if (!await getCurrentProfile()) return { error: "Not authenticated" };
  const { error } = await repository.acceptFamilyTransfer(parsed.data.requestId, parsed.data.accept);
  return error ? { error: "This transfer cannot be answered by your account." } : { success: parsed.data.accept ? "Accepted. Staff approval is still required." : "Transfer declined." };
}
/**
 * Staff approve or reject a request. On approval the database moves
 * responsibility; charges already raised keep their original payer.
 */
export async function reviewFamilyChange(raw: unknown) {
  const parsed = familyReviewSchema.safeParse(raw);
  if (!parsed.success) return { error: "Enter a review note between 3 and 1000 characters." };
  const profile = await getCurrentProfile();
  if (!profile?.is_staff) return { error: "Forbidden" };
  const { error } = await repository.reviewFamilyChange(parsed.data.requestId, parsed.data.approve, parsed.data.note);
  return error ? { error: "Review failed. Approval requires an unchanged relationship, accepted eligible adult payer for transfers, and a verified adult for unlinking." } : { success: parsed.data.approve ? "Responsibility updated. Historical charges retain their original payer." : "Request rejected." };
}
