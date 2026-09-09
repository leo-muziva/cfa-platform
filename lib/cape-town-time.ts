const capeTownLocalDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/

/**
 * `datetime-local` values have no offset. South Africa has a fixed UTC+02:00
 * offset, so attach it before serializing values intended for Cape Town.
 */
export function capeTownDateTimeToIso(value: FormDataEntryValue | null): FormDataEntryValue | null {
  if (typeof value !== 'string') return value
  const source = capeTownLocalDateTime.test(value) ? `${value}+02:00` : value
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}
