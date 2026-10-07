import Link from "next/link";
import { redirect } from "next/navigation";
import { getFamilyChanges } from "@/lib/services/FamilyService";
import { FamilyReviewList } from "@/components/portal/family-review-list";

export default async function FamilyReviewPage() {
  const data = await getFamilyChanges(true);
  if ("error" in data) redirect("/protected");
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Staff family review</h1><p>Review all household responsibility requests. Approval changes future billing responsibility only. Notes are visible to the parties.</p><Link className="underline" href="/protected/family/changes">My family requests</Link>
    <FamilyReviewList requests={data.requests} />
  </div>;
}
