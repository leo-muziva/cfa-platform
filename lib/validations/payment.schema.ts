import { z } from "zod";

export const paymentTargetSchema = z.union([
  z.object({ bookingId: z.uuid(), invoiceId: z.never().optional() }).strict(),
  z.object({ invoiceId: z.uuid(), bookingId: z.never().optional() }).strict(),
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
