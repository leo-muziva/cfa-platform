export interface FamilyChangeRequest {
  id: string;
  family_link_id: string;
  dependent_id: string;
  old_guardian_id: string;
  new_guardian_id: string | null;
  requested_by: string;
  kind: "unlink" | "transfer";
  status: "awaiting_acceptance" | "pending_review" | "approved" | "rejected";
  reason: string;
  accepted_at: string | null;
  review_note: string | null;
  created_at: string;
}
