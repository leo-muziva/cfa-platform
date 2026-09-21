import Link from "next/link";
import { redirect } from "next/navigation";
import { getFamilyChanges } from "@/lib/services/FamilyService";
import { getFamilyAccountsPageData } from "@/lib/services/PlatformService";
import { ActionForm } from "@/components/portal/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestFamilyChangeAction, acceptFamilyTransferAction } from "@/app/actions/family";

export default async function FamilyChangesPage() {
  const [data, family] = await Promise.all([getFamilyChanges(), getFamilyAccountsPageData()]);
  if ("error" in data || "error" in family) redirect("/auth/login");
  const active = family.links.filter((link) => link.status === "active" && (link.dependent_id === data.profile.id || link.guardian_id === data.profile.id));
  return <div className="space-y-6">
    <h1 className="text-3xl font-bold">Family responsibility changes</h1>
    <p>Staff must approve every unlink or transfer. Transfers also require acceptance by the new adult payer. Existing charges stay with their original payer. Minors require a transfer to another adult payer.</p>
    <Link className="underline" href="/protected/family">Back to family accounts</Link>
    {data.profile.is_staff && <p><Link className="underline" href="/protected/family/review">Staff review queue</Link></p>}
    {active.map((link) => <Card key={link.id}><CardHeader><CardTitle>{link.dependent?.full_name || "Dependent"} - {link.guardian?.full_name || "Guardian"}</CardTitle></CardHeader><CardContent>
      <ActionForm action={requestFamilyChangeAction} submitLabel="Request change">
        <input type="hidden" name="link_id" value={link.id} />
        <div><Label htmlFor={`kind-${link.id}`}>Change type</Label><select className="block w-full rounded border bg-background p-2" id={`kind-${link.id}`} name="kind"><option value="transfer">Transfer to another payer</option><option value="unlink">Unlink adult dependent</option></select></div>
        <div><Label htmlFor={`email-${link.id}`}>New payer account email (transfer only)</Label><Input id={`email-${link.id}`} name="new_payer_email" type="email" /></div>
        <div><Label htmlFor={`reason-${link.id}`}>Reason (visible to the parties and staff)</Label><Input id={`reason-${link.id}`} name="reason" minLength={3} maxLength={1000} required /></div>
      </ActionForm>
    </CardContent></Card>)}
    <h2 className="text-xl font-semibold">Requests</h2>
    {data.requests.length === 0 && <p>No responsibility changes requested.</p>}
    {data.requests.map((request) => <Card key={request.id}><CardContent className="space-y-3 pt-6"><p className="font-medium">{request.kind} - {request.status.replaceAll("_", " ")}</p><p>{request.reason}</p>{request.review_note && <p>Staff response: {request.review_note}</p>}
      {request.status === "awaiting_acceptance" && request.new_guardian_id === data.profile.id && <ActionForm action={acceptFamilyTransferAction} submitLabel="Send response"><input type="hidden" name="request_id" value={request.id} /><Label htmlFor={`accept-${request.id}`}>Accept future payer responsibility, subject to staff approval?</Label><select id={`accept-${request.id}`} name="response" className="block rounded border bg-background p-2"><option value="decline">Decline</option><option value="accept">Accept responsibility</option></select></ActionForm>}
    </CardContent></Card>)}
  </div>;
}
