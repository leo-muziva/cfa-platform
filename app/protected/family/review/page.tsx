import Link from "next/link";
import { redirect } from "next/navigation";
import { getFamilyChanges } from "@/lib/services/FamilyService";
import { ActionForm } from "@/components/portal/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewFamilyChangeAction } from "@/app/actions/family";

export default async function FamilyReviewPage() {
  const data = await getFamilyChanges(true);
  if ("error" in data) redirect("/protected");
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Staff family review</h1><p>Review all household responsibility requests. Approval changes future billing responsibility only. Notes are visible to the parties.</p><Link className="underline" href="/protected/family/changes">My family requests</Link>
    {data.requests.length === 0 && <p>No requests.</p>}
    {data.requests.map((request) => <Card key={request.id}><CardContent className="space-y-3 pt-6"><p className="font-semibold">{request.kind} - {request.status.replaceAll("_", " ")}</p><p>Dependent account: {request.dependent_id}</p><p>Current payer: {request.old_guardian_id}</p>{request.new_guardian_id && <p>Proposed payer: {request.new_guardian_id}</p>}<p>Reason: {request.reason}</p>{request.review_note && <p>Review: {request.review_note}</p>}
      {request.status === "pending_review" && <ActionForm action={reviewFamilyChangeAction} submitLabel="Submit staff decision"><input type="hidden" name="request_id" value={request.id} /><div><Label htmlFor={`decision-${request.id}`}>Decision</Label><select id={`decision-${request.id}`} name="response" className="block rounded border bg-background p-2"><option value="reject">Reject</option><option value="approve">Approve</option></select></div><div><Label htmlFor={`note-${request.id}`}>Review note</Label><Input id={`note-${request.id}`} name="note" minLength={3} maxLength={1000} required /></div></ActionForm>}
    </CardContent></Card>)}
  </div>;
}
