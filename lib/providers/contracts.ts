import 'server-only'
import { getPaymentGateway } from '@/lib/payments/registry'
import { getResendConfig, membershipPaymentEmail, plainEmail, sendWithResend, type MembershipPaymentEmail, type SendEmailResult } from '@/lib/providers/resend-email'

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
  const config = getResendConfig()
  if (!config) return null
  const send = async (to: string, subject: string, paragraphs: string[]) => {
    const result = await sendWithResend(config, plainEmail(to, subject, paragraphs))
    if (!result.ok) throw new Error(result.error)
  }
  return {
    name: 'resend',
    sendInvoice: ({ to, invoiceNumber, amount, paymentLink }) => send(to, `CFA invoice ${invoiceNumber}`, [
      `Your Cape Fencing Academy invoice ${invoiceNumber} for R${amount.toFixed(2)} is ready.`,
      ...(paymentLink ? [`Pay here: ${paymentLink}`] : []),
    ]),
    sendReceipt: ({ to, receiptNumber, amount }) => send(to, `CFA receipt ${receiptNumber}`, [
      `Thank you. Cape Fencing Academy received your payment of R${amount.toFixed(2)} (receipt ${receiptNumber}).`,
    ]),
    sendMembershipPaymentRequest: (input) => sendWithResend(config, membershipPaymentEmail(input)),
  }
}
