import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FamilyChangeRequest } from "@/types/family";

export async function listFamilyChanges(profileId: string, staffScope: boolean): Promise<FamilyChangeRequest[]> {
  const db = await createClient();
  let query = db.from("family_change_requests").select("id,family_link_id,dependent_id,old_guardian_id,new_guardian_id,requested_by,kind,status,reason,accepted_at,review_note,created_at");
  if (!staffScope) query = query.or(`dependent_id.eq.${profileId},old_guardian_id.eq.${profileId},new_guardian_id.eq.${profileId}`);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error("Family change requests are unavailable.");
  return (data ?? []) as FamilyChangeRequest[];
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
