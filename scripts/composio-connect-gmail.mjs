// One-off helper: connects the CFA ordering Gmail inbox to Composio when the
// dashboard has no "Connect account" button.
//
// Run it in your own terminal (never paste the key into chat):
//   PowerShell:  $env:COMPOSIO_API_KEY = "<your key>"; node scripts/composio-connect-gmail.mjs ac_XXXX [user-id]
//   bash:        COMPOSIO_API_KEY=<your key> node scripts/composio-connect-gmail.mjs ac_XXXX [user-id]
//
// It prints a sign-in link. Open it, sign in as the ordering Gmail account and
// allow access. The script then prints the two values Vercel needs.
import { Composio } from "@composio/core";

const apiKey = process.env.COMPOSIO_API_KEY;
const [authConfigId, userId = "cfa-ordering"] = process.argv.slice(2);

if (!apiKey) {
  console.error("Set COMPOSIO_API_KEY in this terminal first.");
  process.exit(1);
}
if (!authConfigId || !authConfigId.startsWith("ac_")) {
  console.error("Pass the Gmail auth config ID (starts with ac_) as the first argument.");
  process.exit(1);
}

const composio = new Composio({ apiKey });
const request = await composio.connectedAccounts.link(userId, authConfigId);

console.log("\nOpen this link, sign in as the ordering Gmail account and allow access:\n");
console.log(request.redirectUrl);
console.log("\nWaiting for you to finish signing in...");

const account = await request.waitForConnection();

console.log("\nConnected. Put these in Vercel staging:");
console.log("  COMPOSIO_GMAIL_CONNECTED_ACCOUNT_ID = " + account.id);
console.log("  COMPOSIO_USER_ID                    = " + userId);
