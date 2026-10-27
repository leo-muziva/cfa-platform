// Optional WhatsApp test messaging through Meta's Cloud API. Off by default
// and not used by any page yet.
import "server-only";

// A plain-text WhatsApp message to one approved test recipient.
export interface WhatsAppTestMessage {
  recipient: string;
  body: string;
}

export interface WhatsAppTestProvider {
  send(message: WhatsAppTestMessage): Promise<{ providerReference: string }>;
}

/**
 * This adapter is intentionally off unless a sandbox operator enables it.
 * Recipient approval remains a Meta dashboard responsibility; this code does
 * not contain a fallback number or any personal contact data.
 */
export function getMetaWhatsAppTestProvider(): WhatsAppTestProvider | null {
  const enabled = process.env.CFA_META_WHATSAPP_TEST_ENABLED === "true";
  const accessToken = process.env.META_WHATSAPP_TEST_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_TEST_PHONE_NUMBER_ID?.trim();
  if (!enabled || !accessToken || !phoneNumberId) return null;
  return {
    async send({ recipient, body }) {
      const response = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { body } }),
      });
      if (!response.ok) throw new Error("Meta WhatsApp test message was rejected");
      const data = await response.json() as { messages?: Array<{ id?: string }> };
      const providerReference = data.messages?.[0]?.id;
      if (!providerReference) throw new Error("Meta WhatsApp test response did not include a message ID");
      return { providerReference };
    },
  };
}
