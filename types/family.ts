// A request to unlink a dependent from their guardian, or transfer them to
// a new paying guardian. Transfers wait for the new payer to accept
// (awaiting_acceptance), then for staff (pending_review).
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
  // Names are only present where profile RLS lets the reader see that person.
  dependent?: FamilyChangeParty | null;
  old_guardian?: FamilyChangeParty | null;
  new_guardian?: FamilyChangeParty | null;
}

// The name and email of one person in the request.
export interface FamilyChangeParty {
  full_name: string | null;
  email: string;
}
