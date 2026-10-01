import { z } from "zod";

// Exactly one payment target. The other keys are z.never() so each variant
// rejects them explicitly and TypeScript can read every key on the union.
export const paymentTargetSchema = z.union([
  z.object({
    bookingId: z.uuid(),
    invoiceId: z.never().optional(),
    orderId: z.never().optional(),
    notes: z.never().optional(),
  }).strict(),
  z.object({
    invoiceId: z.uuid(),
    bookingId: z.never().optional(),
    orderId: z.never().optional(),
    notes: z.never().optional(),
  }).strict(),
  z.object({
    orderId: z.uuid(),
    notes: z.string().trim().max(500).optional(),
    bookingId: z.never().optional(),
    invoiceId: z.never().optional(),
  }).strict(),
]);

export const paymentAttemptSchema = z.uuid();

export const paymentEventSchema = z.object({
  provider: z.string().min(1).max(64),
  eventId: z.string().min(1).max(200),
  paymentId: z.string().min(1).max(200),
  reference: z.string().min(1).max(100),
  status: z.enum(["pending", "succeeded", "failed", "cancelled"]),
  amountCents: z.string().regex(/^[1-9]\d{0,15}$/),
  currency: z.literal("ZAR"),
});

export type PaymentTarget = z.infer<typeof paymentTargetSchema>;
