// Zod schemas for family change requests (unlink a dependent, or transfer
// them to a new paying guardian) and the staff review.
import { z } from "zod";

// A transfer needs the new payer's email; an unlink does not.
export const familyChangeSchema = z.object({
  linkId: z.uuid(),
  kind: z.enum(["unlink", "transfer"]),
  newPayerEmail: z.union([z.email(), z.literal("")]).default(""),
  reason: z.string().trim().min(3).max(1000),
}).refine((value) => value.kind !== "transfer" || value.newPayerEmail !== "", {
  message: "Enter the new payer's account email.", path: ["newPayerEmail"],
});
export const familyAcceptanceSchema = z.object({ requestId: z.uuid(), accept: z.boolean() });
export const familyReviewSchema = z.object({ requestId: z.uuid(), approve: z.boolean(), note: z.string().trim().min(3).max(1000) });
