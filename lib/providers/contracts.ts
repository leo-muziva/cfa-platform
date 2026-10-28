// Older provider interfaces still used by PlatformService. getEmailProvider
// wraps the email transport; getPaymentProvider only reports whether a
// gateway exists, because checkout now goes through lib/payments instead.
import 'server-only'
import { getPaymentGateway } from '@/lib/payments/registry'
import { membershipPaymentEmail, plainEmail, type MembershipPaymentEmail, type SendEmailResult } from '@/lib/providers/resend-email'
import { getEmailTransport, sendEmail } from '@/lib/providers/email-transport'
import { formatRandsWithCents } from '@/lib/money'

// Shape of the older payment-link provider. Not implemented; see lib/payments.
export interface PaymentLinkRequest {
  invoiceId: string
  invoiceNumber: string
  amount: number
  payerEmail: string
  returnUrl: string
}

export interface PaymentProvider {
  readonly name: string
  createPaymentLink(request: PaymentLinkRequest): Promise<{ url: string; providerReference: string }>
  verifyWebhook(payload: string, signature: string | null): Promise<{
    eventId: string
    invoiceNumber: string
    status: 'succeeded' | 'failed'
    providerReference: string
  }>
}

// Emails the platform sends about receipts and memberships. Invoice emails
// carry a PDF and go through lib/services/invoice-document-service.ts.
export interface EmailProvider {
  readonly name: string
  sendReceipt(input: { to: string; receiptNumber: string; amount: number }): Promise<void>
  sendMembershipPaymentRequest(input: MembershipPaymentEmail): Promise<SendEmailResult>
}

/** Thrown when a provider feature is called but not configured. */
export class ProviderUnavailableError extends Error {
  constructor(kind: 'payment' | 'email') {
    super(`${kind[0].toUpperCase()}${kind.slice(1)} provider is not configured`)
    this.name = 'ProviderUnavailableError'
  }
}

/**
 * Non-null when a payment gateway is configured. Its methods always throw:
 * payment links are not implemented, and checkout uses lib/payments.
 */
export function getPaymentProvider(): PaymentProvider | null {
  const gateway = getPaymentGateway()
  return gateway ? { name: gateway.name, createPaymentLink: async () => { throw new ProviderUnavailableError('payment') }, verifyWebhook: async () => { throw new ProviderUnavailableError('payment') } } : null
}

/** Email sending through the configured transport, or null when email is off. */
export function getEmailProvider(): EmailProvider | null {
  const transport = getEmailTransport()
  if (!transport) return null
  const send = async (to: string, subject: string, paragraphs: string[]) => {
    const result = await sendEmail(transport, plainEmail(to, subject, paragraphs))
    if (!result.ok) throw new Error(result.error)
  }
  return {
    name: transport.kind,
    sendReceipt: ({ to, receiptNumber, amount }) => send(to, `CFA receipt ${receiptNumber}`, [
      `Thank you. Cape Fencing Academy received your payment of ${formatRandsWithCents(amount)} (receipt ${receiptNumber}).`,
    ]),
    sendMembershipPaymentRequest: (input) => sendEmail(transport, membershipPaymentEmail(input)),
  }
}
