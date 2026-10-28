import { z } from "zod";

// Trims a form field and limits its length to match the database checks.
const field = (label: string, max: number) =>
  z.string({ error: `Enter the ${label}.` }).trim().max(max, `The ${label} must be ${max} characters or fewer.`);

// The club details printed on invoices. Only the club name is required; a
// blank bank field is left off the PDF.
export const clubBillingSettingsSchema = z.object({
  club_name: field("club name", 120).min(1, "Enter the club name."),
  address: field("address", 300),
  email: field("email address", 200).refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address."),
  bank_name: field("bank name", 120),
  account_name: field("account name", 120),
  account_number: field("account number", 40).regex(/^[\d ]*$/, "Use digits and spaces only for the account number."),
  branch_code: field("branch code", 20).regex(/^[\d ]*$/, "Use digits and spaces only for the branch code."),
});

export type ClubBillingSettingsInput = z.infer<typeof clubBillingSettingsSchema>;

// Staff send one invoice, or every invoice not yet sent.
export const invoiceSendSchema = z.union([
  z.object({ scope: z.literal("one"), invoice_id: z.uuid("Choose an invoice to send.") }),
  z.object({ scope: z.literal("all_unsent") }),
]);
