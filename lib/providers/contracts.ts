import 'server-only'
import { getPaymentGateway } from '@/lib/payments/registry'
import { membershipPaymentEmail, plainEmail, type MembershipPaymentEmail, type SendEmailResult } from '@/lib/providers/resend-email'
import { getEmailTransport, sendEmail } from '@/lib/providers/email-transport'
import { formatRands } from '@/lib/money'

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

export interface EmailProvider {
  readonly name: string
  sendInvoice(input: { to: string; invoiceNumber: string; amount: number; paymentLink: string | null }): Promise<void>
  sendReceipt(input: { to: string; receiptNumber: string; amount: number }): Promise<void>
  sendMembershipPaymentRequest(input: MembershipPaymentEmail): Promise<SendEmailResult>
}

export class ProviderUnavailableError extends Error {
  constructor(kind: 'payment' | 'email') {
    super(`${kind[0].toUpperCase()}${kind.slice(1)} provider is not configured`)
    this.name = 'ProviderUnavailableError'
  }
}

export function getPaymentProvider(): PaymentProvider | null {
  const gateway = getPaymentGateway()
  return gateway ? { name: gateway.name, createPaymentLink: async () => { throw new ProviderUnavailableError('payment') }, verifyWebhook: async () => { throw new ProviderUnavailableError('payment') } } : null
}

export function getEmailProvider(): EmailProvider | null {
  const transport = getEmailTransport()
  if (!transport) return null
  const send = async (to: string, subject: string, paragraphs: string[]) => {
    const result = await sendEmail(transport, plainEmail(to, subject, paragraphs))
    if (!result.ok) throw new Error(result.error)
  }
  return {
    name: transport.kind,
    sendInvoice: ({ to, invoiceNumber, amount, paymentLink }) => send(to, `CFA invoice ${invoiceNumber}`, [
      `Your Cape Fencing Academy invoice ${invoiceNumber} for ${formatRands(amount)} is ready.`,
      ...(paymentLink ? [`Pay here: ${paymentLink}`] : []),
    ]),
    sendReceipt: ({ to, receiptNumber, amount }) => send(to, `CFA receipt ${receiptNumber}`, [
      `Thank you. Cape Fencing Academy received your payment of ${formatRands(amount)} (receipt ${receiptNumber}).`,
    ]),
    sendMembershipPaymentRequest: (input) => sendEmail(transport, membershipPaymentEmail(input)),
  }
}
