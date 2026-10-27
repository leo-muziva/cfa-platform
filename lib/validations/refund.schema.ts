import { z } from "zod";

// R1,000,000 is far above any club payment; it guards against typos.
export const MAX_REFUND_CENTS = 100_000_000;

// Up to seven whole rand digits and at most two decimals.
const RAND_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

// Converts a typed rand amount ("125.50", "R 1 250") to whole cents without
// floating point, or null when it is not a valid amount.
export function randsToCents(value: string): number | null {
  const cleaned = value.trim().replace(/^R/i, "").replace(/[\s,]/g, "");
  if (!RAND_PATTERN.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

// Form fields arrive as strings; blank optional fields mean "not given".
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// A typed rand amount, checked and converted to cents.
const amountCents = z
  .string({ error: "Enter a refund amount." })
  .transform((value, ctx) => {
    const cents = randsToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in rands, for example 125.50." });
      return z.NEVER;
    }
    if (cents <= 0) {
      ctx.addIssue({ code: "custom", message: "The refund amount must be more than R0." });
      return z.NEVER;
    }
    if (cents > MAX_REFUND_CENTS) {
      ctx.addIssue({ code: "custom", message: "The refund amount cannot exceed R1,000,000." });
      return z.NEVER;
    }
    return cents;
  });

const refundId = z.uuid({ error: "Choose a valid refund." });

export const refundMethodSchema = z.enum(["manual_bank", "provider"], { error: "Choose how the refund is paid." });

export const requestRefundSchema = z.object({
  attemptId: z.uuid({ error: "Choose a valid payment." }),
  amount: amountCents,
  reason: z
    .string({ error: "Give a reason for the refund." })
    .trim()
    .min(1, "Give a reason for the refund.")
    .max(500, "Keep the reason under 500 characters."),
}).transform(({ attemptId, amount, reason }) => ({ attemptId, amountCents: amount, reason }));

// Rejecting needs a note; approving needs a payout method. A lower amount
// may be approved; blank means the amount requested.
export const decideRefundSchema = z
  .object({
    refundId,
    decision: z.enum(["approve", "reject"], { error: "Choose approve or reject." }),
    method: z.preprocess(blankToUndefined, refundMethodSchema.optional()),
    note: z.preprocess(
      blankToUndefined,
      z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
    ),
    amount: z.preprocess(blankToUndefined, amountCents.optional()),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "reject" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Add a note explaining why the refund is rejected." });
    }
    if (value.decision === "approve" && !value.method) {
      ctx.addIssue({ code: "custom", path: ["method"], message: "Choose how the refund is paid." });
    }
  })
  .transform(({ amount, ...rest }) => ({ ...rest, amountCents: amount }));

// Staff confirm a bank transfer refund with its reference.
export const completeManualRefundSchema = z.object({
  refundId,
  reference: z
    .string({ error: "Enter the bank transfer reference." })
    .trim()
    .min(1, "Enter the bank transfer reference.")
    .max(200, "Keep the reference under 200 characters."),
});

export const providerRefundSchema = z.object({ refundId });

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;
export type DecideRefundInput = z.infer<typeof decideRefundSchema>;
// Settles a provider refund left 'processing' after an unconfirmed PayFast
// call. Staff record what the PayFast dashboard shows.
export const resolveProcessingRefundSchema = z
  .object({
    refundId,
    outcome: z.enum(["processed", "failed"], { error: "Choose what PayFast shows for this refund." }),
    reference: z.string().trim().max(200, "Keep the reference under 200 characters.").optional(),
    note: z
      .string({ error: "Explain what you checked." })
      .trim()
      .min(1, "Explain what you checked.")
      .max(500, "Keep the note under 500 characters."),
  })
  .refine((value) => value.outcome === "failed" || Boolean(value.reference), {
    message: "Enter the PayFast refund reference.",
    path: ["reference"],
  });

export type ResolveProcessingRefundInput = z.infer<typeof resolveProcessingRefundSchema>;
export type CompleteManualRefundInput = z.infer<typeof completeManualRefundSchema>;
export type ProviderRefundInput = z.infer<typeof providerRefundSchema>;
