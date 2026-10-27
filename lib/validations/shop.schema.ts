import { z } from "zod";

// Customer shop inputs. Prices, order ids and statuses are never taken from
// the browser: the service reads them from the database.

export const handednessSchema = z.enum(["right", "left"]);

export const addToCartSchema = z
  .object({
    productId: z.number().int().positive(),
    // An empty choice from a form means "no size".
    size: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .transform((value) => (value === "" ? null : value)),
    handedness: handednessSchema.nullable(),
  })
  .strict();

// A quantity of 0 removes the line.
export const updateQuantitySchema = z
  .object({
    itemId: z.uuid(),
    quantity: z.number().int().min(0).max(99),
  })
  .strict();

export const removeItemSchema = z
  .object({
    itemId: z.uuid(),
  })
  .strict();

// Optional notes for CFA staff about the order.
export const checkoutSchema = z
  .object({
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateQuantityInput = z.infer<typeof updateQuantitySchema>;
export type RemoveItemInput = z.infer<typeof removeItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
