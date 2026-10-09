const MAX_ERROR_LENGTH = 300;

// Provider errors can echo request details. Keep them short and strip
// email addresses and links before they are stored or shown to staff.
export function cleanErrorText(message: string, maxLength = MAX_ERROR_LENGTH): string {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[address]")
    .replace(/\bhttps?:\/\/\S+/gi, "[link]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
