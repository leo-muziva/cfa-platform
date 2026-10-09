import { ActionForm } from "@/components/portal/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewFamilyChangeAction } from "@/app/actions/family";
import type { FamilyChangeParty, FamilyChangeRequest } from "@/types/family";

const statusLabels: Record<FamilyChangeRequest["status"], string> = {
  awaiting_acceptance: "Waiting for the new payer to accept",
  pending_review: "Waiting for staff review",
  approved: "Approved",
  rejected: "Rejected",
};

function person(party: FamilyChangeParty | null | undefined, fallbackId: string) {
  if (!party) return `Account ${fallbackId.slice(0, 8)}`;
  return party.full_name ? `${party.full_name} (${party.email})` : party.email;
}

// Pending reviews first so staff see what needs action before history.
export function FamilyReviewList({ requests }: { requests: FamilyChangeRequest[] }) {
  if (requests.length === 0) return <p className="text-muted-foreground">No family responsibility requests.</p>;
  const ordered = [...requests].sort((a, b) => Number(b.status === "pending_review") - Number(a.status === "pending_review"));
  return <div className="space-y-4">{ordered.map((request) => <Card key={request.id}><CardContent className="space-y-2 pt-6">
    <p className="font-semibold">{request.kind === "unlink" ? "Unlink" : "Transfer"} - {statusLabels[request.status]}</p>
    <p>Dependent: {person(request.dependent, request.dependent_id)}</p>
    <p>Current payer: {person(request.old_guardian, request.old_guardian_id)}</p>
    {request.new_guardian_id && <p>Proposed payer: {person(request.new_guardian, request.new_guardian_id)}</p>}
    <p>Reason: {request.reason}</p>
    <p className="text-sm text-muted-foreground">Requested {new Date(request.created_at).toLocaleDateString("en-ZA", { dateStyle: "medium" })}</p>
    {request.review_note && <p>Review note: {request.review_note}</p>}
    {request.status === "pending_review" && <ActionForm action={reviewFamilyChangeAction} submitLabel="Submit staff decision"><input type="hidden" name="request_id" value={request.id} /><div><Label htmlFor={`decision-${request.id}`}>Decision</Label><select id={`decision-${request.id}`} name="response" className="block rounded border bg-background p-2"><option value="reject">Reject</option><option value="approve">Approve</option></select></div><div><Label htmlFor={`note-${request.id}`}>Review note (visible to the parties)</Label><Input id={`note-${request.id}`} name="note" minLength={3} maxLength={1000} required /></div></ActionForm>}
  </CardContent></Card>)}</div>;
}
