import { redirect } from "next/navigation";
import { getFamilyChanges } from "@/lib/services/FamilyService";
import { FamilyReviewList } from "@/components/portal/family-review-list";

/** /protected/admin/family-requests: staff queue of unlink and transfer requests. */
export default async function AdminFamilyRequestsPage() {
  const data = await getFamilyChanges(true);
  if ("error" in data) redirect("/protected");
  const waiting = data.requests.filter((request) => request.status === "pending_review").length;
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Family requests</h1><p className="text-muted-foreground">Unlink and transfer requests from households. Approval changes future billing responsibility only; existing charges stay with their original payer. {waiting} waiting for review.</p></div>
    <FamilyReviewList requests={data.requests} />
  </div>;
}
