import 'server-only'
import { getPaymentGateway } from '@/lib/payments/registry'

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
  return null
}
