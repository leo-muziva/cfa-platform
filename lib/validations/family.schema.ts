import { z } from "zod";

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

// Same rule as the database (review_family_change): an adult is 18 or older
// today in Cape Town. No date of birth means not a verified adult.
export function isAdultOn(dateOfBirth: string | null | undefined, todayIso: string): boolean {
  if (!dateOfBirth) return false;
  const [year, month, day] = todayIso.split("-").map(Number);
  const cutoff = `${String(year - 18).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return dateOfBirth.slice(0, 10) <= cutoff;
}

export function todayInCapeTown(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}
