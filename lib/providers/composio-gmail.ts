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

// The SDK wraps API failures as "Error executing the tool X" and keeps the
// real reason (HTTP status and the API message) on error.cause. Pull those
// out so staff and the run log can see why Gmail refused.
export function describeComposioError(error: unknown): string {
  if (!(error instanceof Error)) return "Could not reach Composio.";
  const parts = [error.message];
  let cause: unknown = error.cause;
  for (let depth = 0; depth < 3 && cause && typeof cause === "object"; depth++) {
    const c = cause as { status?: unknown; message?: unknown; error?: { message?: unknown; error?: { message?: unknown } }; cause?: unknown };
    const apiMessage = c.error?.error?.message ?? c.error?.message ?? c.message;
    const detail = [typeof c.status === "number" ? String(c.status) : null, typeof apiMessage === "string" ? apiMessage : null]
      .filter(Boolean)
      .join(": ");
    if (detail && !parts.includes(detail)) parts.push(detail);
    cause = c.cause;
  }
  return cleanProviderError(parts.join(" - "));
}

function failure(tool: string, error: unknown): { ok: false; error: string } {
  const message = describeComposioError(error);
  // Cleaned text only: never the arguments, keys or file.
  console.error("[composio-gmail]", tool, message);
  return { ok: false, error: message };
}

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
  // Optional: when unset, the owner is read from the connected account.
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

// Composio needs the user that owns the Gmail connection as well as the
// connection itself. When COMPOSIO_USER_ID is not set, read the owner from
// the connection record. A connection that is not ACTIVE (for example
// expired) needs reconnecting in Composio, so say that plainly.
export function connectionOwner(account: { user_id?: unknown; status?: unknown }): { ok: true; userId: string } | { ok: false; error: string } {
  if (typeof account.status === "string" && account.status !== "ACTIVE") {
    return { ok: false, error: "The Gmail connection in Composio is " + account.status.toLowerCase() + ". Reconnect Gmail in Composio and try again." };
  }
  if (typeof account.user_id !== "string" || account.user_id === "") {
    return { ok: false, error: "The Gmail connection in Composio has no user. Set COMPOSIO_USER_ID in Vercel." };
  }
  return { ok: true, userId: account.user_id };
}

// Owners only change if Gmail is reconnected, which also changes the ID.
const ownerCache = new Map<string, string>();

export function createComposioGmailProvider(config: ComposioGmailConfig): GmailDraftProvider {
  // Automatic file staging stays off (the SDK default): it would let tool
  // arguments name files on this server. The attachment is staged explicitly.
  const composio = new Composio({ apiKey: config.apiKey });

  async function ownerId(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
    if (config.userId) return { ok: true, userId: config.userId };
    const cached = ownerCache.get(config.connectedAccountId);
    if (cached) return { ok: true, userId: cached };
    const account = await composio.getClient().connectedAccounts.retrieve(config.connectedAccountId, { signal: AbortSignal.timeout(15_000) });
    const owner = connectionOwner(account);
    if (owner.ok) ownerCache.set(config.connectedAccountId, owner.userId);
    return owner;
  }

  function execute(tool: string, userId: string, args: Record<string, unknown>) {
    return composio.tools.execute(
      tool,
      {
        userId,
        connectedAccountId: config.connectedAccountId,
        ...(config.toolkitVersion ? { version: config.toolkitVersion } : { dangerouslySkipVersionCheck: true }),
        arguments: args,
      },
      { signal: AbortSignal.timeout(30_000) }
    );
  }

  return {
    async createDraft(input) {
      try {
        const owner = await ownerId();
        if (!owner.ok) return owner;
        const file = new File([new Uint8Array(input.attachment.content)], input.attachment.name, { type: input.attachment.mimeType });
        const staged = await composio.files.upload({ file, toolSlug: DRAFT_TOOL, toolkitSlug: GMAIL_TOOLKIT });
        const response = await execute(DRAFT_TOOL, owner.userId, {
          recipient_email: input.recipient,
          subject: input.subject,
          body: input.body,
          is_html: false,
          attachment: { name: staged.name, mimetype: staged.mimetype, s3key: staged.s3key },
        });
        if (!response.successful) {
          return { ok: false, error: cleanProviderError(response.error ?? "Gmail did not accept the draft.") };
        }
        return { ok: true, draftId: extractDraftId(response.data) };
      } catch (error) {
        return failure(DRAFT_TOOL, error);
      }
    },
  };
}

export function getGmailDraftProvider(env: Env = process.env): GmailDraftProvider | null {
  const config = getComposioGmailConfig(env);
  return config ? createComposioGmailProvider(config) : null;
}
