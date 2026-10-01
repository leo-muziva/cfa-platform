import { z } from 'zod'

// Mirrors the admin product form. Prices arrive as the text typed into the
// form, so the schema checks the text before turning it into a number.
const priceText = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Price must be 0 or more with at most 2 decimals.')

// Empty optional fields become null rather than empty strings.
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))

export const productInputSchema = z.object({
  item_code: z
    .string()
    .trim()
    .min(1, 'Item code is required.')
    .max(40, 'Item code must be 40 characters or fewer.')
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required.')
    .max(200, 'Product name must be 200 characters or fewer.'),
  description: optionalText,
  price: priceText.transform((value) => Number(value)),
  category: optionalText,
  sizes: optionalText,
  is_active: z.boolean(),
}).strict()

export type ProductRowInput = z.output<typeof productInputSchema>

export const productIdSchema = z.number().int().positive()
