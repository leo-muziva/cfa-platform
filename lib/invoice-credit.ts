import { formatZarWithCents } from "@/lib/money";

/**
 * The line under an unpaid invoice that explains credit, so the invoice total
 * and the amount to pay never look like they disagree.
 *
 * dueCents is what is left on the invoice now (credit already applied and
 * payments taken off). availableCreditCents is credit not used yet, which
 * checkout applies to this invoice first.
 */
export function invoiceCreditNote(totalCents: number, dueCents: number, availableCreditCents: number): string | null {
  const alreadyApplied = Math.max(0, totalCents - dueCents);
  const willApply = Math.min(Math.max(0, availableCreditCents), dueCents);
  const toPay = dueCents - willApply;
  if (willApply > 0) {
    return toPay === 0
      ? `Your ${formatZarWithCents(willApply)} account credit covers this invoice, so there is nothing to pay.`
      : `Your ${formatZarWithCents(willApply)} account credit is applied to this invoice when you pay, so you pay ${formatZarWithCents(toPay)}.`;
  }
  if (alreadyApplied > 0) {
    return `${formatZarWithCents(alreadyApplied)} has already been taken off with account credit. Left to pay: ${formatZarWithCents(dueCents)}.`;
  }
  return null;
}
