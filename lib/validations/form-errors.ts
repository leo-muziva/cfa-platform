import type { z } from 'zod'

/** Field name -> first problem with it, keyed by the schema's top-level path. */
export type FieldErrors = Record<string, string>

export interface ValidationFailure {
  error: string
  fieldErrors: FieldErrors
}

/** First message for each top-level field. Form-level issues (empty path) are skipped. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (field === undefined) continue
    const key = String(field)
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

/** "emergency_contact_phone" / "emergencyContactPhone" -> "Emergency contact phone". */
export function fieldLabel(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Turns a Zod failure into a message naming each invalid field plus the
 * per-field errors forms use to highlight them. Issues that belong to the
 * whole form keep their own message.
 */
export function validationFailure(error: z.ZodError, labels: Record<string, string> = {}): ValidationFailure {
  const fieldErrors = fieldErrorsFrom(error)
  const names = Object.keys(fieldErrors)
  if (names.length === 0) return { error: error.issues[0]?.message ?? 'Check the form and try again.', fieldErrors }
  if (names.length === 1) {
    const [name] = names
    return { error: `${labels[name] ?? fieldLabel(name)}: ${fieldErrors[name]}`, fieldErrors }
  }
  return { error: `Check the highlighted fields: ${names.map((name) => labels[name] ?? fieldLabel(name)).join(', ')}`, fieldErrors }
}

/** The part of a failed service result a form state needs. */
export function failureState(result: { error?: string; fieldErrors?: FieldErrors }) {
  return { error: result.error ?? 'Something went wrong. Try again.', fieldErrors: result.fieldErrors }
}
