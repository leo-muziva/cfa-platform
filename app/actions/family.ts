"use server";
import { revalidatePath } from "next/cache";
import * as service from "@/lib/services/FamilyService";
import type { ActionState } from "@/app/actions/platform";

function refresh() {
  revalidatePath("/protected/family");
  revalidatePath("/protected/family/changes");
  revalidatePath("/protected/family/review");
  revalidatePath("/protected/admin/family-requests");
}
export async function requestFamilyChangeAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await service.requestFamilyChange({ linkId: form.get("link_id"), kind: form.get("kind"), newPayerEmail: form.get("new_payer_email") || "", reason: form.get("reason") });
  refresh(); return result;
}
export async function acceptFamilyTransferAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await service.acceptFamilyTransfer({ requestId: form.get("request_id"), accept: form.get("response") === "accept" });
  refresh(); return result;
}
export async function reviewFamilyChangeAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const result = await service.reviewFamilyChange({ requestId: form.get("request_id"), approve: form.get("response") === "approve", note: form.get("note") });
  refresh(); return result;
}
