import "server-only";
import { Composio } from "@composio/core";
import { cleanErrorText } from "@/lib/clean-error";

// Creates a Gmail draft in CFA's ordering mailbox through Composio. Only
// the draft action is ever called: nothing here can send mail. A person
// opens the draft in Gmail and presses Send.
//
// The Gmail connection needs the gmail.compose scope, which Google also
// allows to send mail, so connect a dedicated ordering mailbox rather than
// someone's personal account.

const DRAFT_TOOL = "GMAIL_CREATE_EMAIL_DRAFT";
const GMAIL_TOOLKIT = "gmail";
// Kept as a named export for this provider's callers and tests.
export const cleanProviderError = (message: string) => cleanErrorText(message);

export interface GmailDraftAttachment {
  name: string;
  mimeType: string;
  content: Buffer;
}

export interface GmailDraftInput {
  recipient: string;
  subject: string;
  body: string;
  // The saved spreadsheet itself. It is uploaded to Composio here, so no
  // link to our storage ever leaves the server.
  attachment: GmailDraftAttachment;
}

export type GmailDraftResult = { ok: true; draftId: string | null } | { ok: false; error: string };

export interface GmailDraftProvider {
  createDraft(input: GmailDraftInput): Promise<GmailDraftResult>;
}

type Env = Record<string, string | undefined>;

export interface ComposioGmailConfig {
  apiKey: string;
  // Optional: the connected account ID alone identifies the inbox.
  userId: string | null;
  connectedAccountId: string;
  toolkitVersion: string | null;
}

export function getComposioGmailConfig(env: Env = process.env): ComposioGmailConfig | null {
  const apiKey = env.COMPOSIO_API_KEY?.trim();
  const connectedAccountId = env.COMPOSIO_GMAIL_CONNECTED_ACCOUNT_ID?.trim();
  if (!apiKey || !connectedAccountId) return null;
  return {
    apiKey,
    connectedAccountId,
    userId: env.COMPOSIO_USER_ID?.trim() || null,
    toolkitVersion: env.COMPOSIO_GMAIL_TOOLKIT_VERSION?.trim() || null,
  };
}

// Composio's response shape varies by toolkit version, so look for the id
// in the places Gmail draft responses put it.
export function extractDraftId(data: Record<string, unknown>): string | null {
  const candidates = [data.id, (data.draft as { id?: unknown } | undefined)?.id, (data.response_data as { id?: unknown } | undefined)?.id];
  const found = candidates.find((value) => typeof value === "string" && value.length > 0);
  return typeof found === "string" ? found : null;
}

export function createComposioGmailProvider(config: ComposioGmailConfig): GmailDraftProvider {
  // Automatic file staging stays off (the SDK default): it would let tool
  // arguments name files on this server. The attachment is staged explicitly.
  const composio = new Composio({ apiKey: config.apiKey });

  return {
    async createDraft(input) {
      try {
        const file = new File([new Uint8Array(input.attachment.content)], input.attachment.name, { type: input.attachment.mimeType });
        const staged = await composio.files.upload({ file, toolSlug: DRAFT_TOOL, toolkitSlug: GMAIL_TOOLKIT });
        const response = await composio.tools.execute(
          DRAFT_TOOL,
          {
            ...(config.userId ? { userId: config.userId } : {}),
            connectedAccountId: config.connectedAccountId,
            ...(config.toolkitVersion ? { version: config.toolkitVersion } : { dangerouslySkipVersionCheck: true }),
            arguments: {
              recipient_email: input.recipient,
              subject: input.subject,
              body: input.body,
              is_html: false,
              attachment: { name: staged.name, mimetype: staged.mimetype, s3key: staged.s3key },
            },
          },
          { signal: AbortSignal.timeout(30_000) }
        );
        if (!response.successful) {
          return { ok: false, error: cleanProviderError(response.error ?? "Gmail did not accept the draft.") };
        }
        return { ok: true, draftId: extractDraftId(response.data) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? cleanProviderError(error.message) : "Could not reach Composio." };
      }
    },
  };
}

export function getGmailDraftProvider(env: Env = process.env): GmailDraftProvider | null {
  const config = getComposioGmailConfig(env);
  return config ? createComposioGmailProvider(config) : null;
}
