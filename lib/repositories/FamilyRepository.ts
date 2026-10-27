import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FamilyChangeRequest } from "@/types/family";

export async function listFamilyChanges(profileId: string, staffScope: boolean): Promise<FamilyChangeRequest[]> {
  const db = await createClient();
  let query = db.from("family_change_requests").select("id,family_link_id,dependent_id,old_guardian_id,new_guardian_id,requested_by,kind,status,reason,accepted_at,review_note,created_at,dependent:profiles!family_change_requests_dependent_id_fkey(full_name,email),old_guardian:profiles!family_change_requests_old_guardian_id_fkey(full_name,email),new_guardian:profiles!family_change_requests_new_guardian_id_fkey(full_name,email)");
  if (!staffScope) query = query.or(`dependent_id.eq.${profileId},old_guardian_id.eq.${profileId},new_guardian_id.eq.${profileId}`);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error("Family change requests are unavailable.");
  return (data ?? []) as unknown as FamilyChangeRequest[];
}
// Date of birth of the dependent on each link, for the adult-only unlink rule.
export async function getLinkDependentBirthDates(linkIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (linkIds.length === 0) return result;
  const db = await createClient();
  const { data } = await db.from("family_links").select("id,dependent:profiles!family_links_dependent_id_fkey(date_of_birth)").in("id", linkIds);
  for (const row of (data ?? []) as unknown as { id: string; dependent: { date_of_birth: string | null } | { date_of_birth: string | null }[] | null }[]) {
    const dependent = Array.isArray(row.dependent) ? row.dependent[0] : row.dependent;
    result.set(row.id, dependent?.date_of_birth ?? null);
  }
  return result;
}
export async function requestFamilyChange(input: { linkId: string; kind: string; newPayerEmail: string; reason: string }) {
  const db = await createClient();
  return db.rpc("request_family_change", { target_link: input.linkId, change_kind: input.kind, new_payer_email: input.newPayerEmail || null, request_reason: input.reason });
}
export async function acceptFamilyTransfer(requestId: string, accept: boolean) {
  const db = await createClient();
  return db.rpc("accept_family_transfer", { target_request: requestId, accept_transfer: accept });
}
export async function reviewFamilyChange(requestId: string, approve: boolean, note: string) {
  const db = await createClient();
  return db.rpc("review_family_change", { target_request: requestId, approve_change: approve, staff_note: note });
}
