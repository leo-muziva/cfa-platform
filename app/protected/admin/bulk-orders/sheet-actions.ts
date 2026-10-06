"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/services/MemberService";
import { bulkOrderIdSchema } from "@/lib/validations/bulk-order.schema";
import {
  approveAndCreateDraft,
  approveUpdatedSheet,
  generateSheet,
  getSheetDownloadUrl,
  markSheetSent,
  runAiProof,
  type SheetErrorCode,
  type SheetResult,
} from "@/lib/services/supplier-sheet-service";
import { getBulkOrderSummary } from "@/lib/repositories/supplier-sheet-repository";
import { advanceStatus } from "./actions";

// Staff buttons for the supplier order sheet. Each one is a deliberate
// click; nothing here runs automatically.

export type SheetActionResult =
  | { success: true; message: string; url?: string; error?: undefined }
  | { error: string; success?: undefined };

const MESSAGES: Record<SheetErrorCode, string> = {
  bulk_order_not_found: "Bulk order not found.",
  bulk_order_closed: "This bulk order is closed.",
  no_paid_orders: "There are no paid orders in this bulk order yet.",
  no_sheet: "Generate the orders spreadsheet first.",
  already_sent: "This spreadsheet has already been sent to the supplier.",
  needs_approval: "The spreadsheet was updated with new orders. Approve the updated sheet first.",
  not_needs_approval: "There is no updated sheet waiting for approval.",
  not_proofed: "Run the AI proof first.",
  not_approved: "Approve the spreadsheet and create the Gmail draft first.",
  ai_running: "The AI proof is already running. Give it a moment.",
  too_soon: "The AI proof ran a moment ago. Wait 30 seconds and try again.",
  file_unreadable: "The saved spreadsheet could not be read. Generate it again.",
  storage_failed: "The spreadsheet could not be saved. Try again.",
  gmail_not_connected: "Gmail is not connected yet. Ask the site admin to set up the ordering mailbox.",
  supplier_email_missing: "The supplier's email address has not been set up yet.",
  gmail_failed: "Gmail did not accept the draft.",
  changed: "Someone else changed this spreadsheet. Refresh the page and try again.",
};

function toError<T>(result: SheetResult<T> & { ok: false }): SheetActionResult {
  const base = MESSAGES[result.code];
  return { error: result.message && result.code !== "file_unreadable" ? base + " " + result.message : base };
}

async function staff(bulkOrderId: string): Promise<{ actorId: string } | { error: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: "Only admins can do that." };
  if (!bulkOrderIdSchema.safeParse(bulkOrderId).success) return { error: "Invalid bulk order." };
  return { actorId: admin.profile.id };
}

function refresh() {
  revalidatePath("/protected/admin/bulk-orders");
}

export async function generateOrdersSpreadsheet(bulkOrderId: string): Promise<SheetActionResult> {
  const actor = await staff(bulkOrderId);
  if ("error" in actor) return { error: actor.error };
  const result = await generateSheet(bulkOrderId, actor.actorId);
  if (!result.ok) return toError(result);
  refresh();
  return { success: true, message: "Spreadsheet saved with " + result.data.lines.length + " rows." };
}

export async function runAiProofAction(bulkOrderId: string): Promise<SheetActionResult> {
  const actor = await staff(bulkOrderId);
  if ("error" in actor) return { error: actor.error };
  const result = await runAiProof(bulkOrderId, actor.actorId);
  if (!result.ok) return toError(result);
  refresh();
  return result.data.kind === "needs_approval"
    ? { success: true, message: "The spreadsheet was out of date and has been updated: " + result.data.check.description + " Check it, then approve the updated sheet." }
    : { success: true, message: "AI proof finished. Read the briefing below." };
}

export async function approveUpdatedSheetAction(bulkOrderId: string): Promise<SheetActionResult> {
  const actor = await staff(bulkOrderId);
  if ("error" in actor) return { error: actor.error };
  const result = await approveUpdatedSheet(bulkOrderId, actor.actorId);
  if (!result.ok) return toError(result);
  refresh();
  return result.data.kind === "needs_approval"
    ? { success: true, message: "More orders came in, so the sheet was updated again. Check it and approve once more." }
    : { success: true, message: "Updated sheet approved and AI proof finished." };
}

const emailBodySchema = z.string().trim().min(1, "Write the email to the supplier.").max(3000, "Keep the email under 3,000 characters.");

export async function approveAndCreateDraftAction(bulkOrderId: string, emailBody: string): Promise<SheetActionResult> {
  const actor = await staff(bulkOrderId);
  if ("error" in actor) return { error: actor.error };
  const body = emailBodySchema.safeParse(emailBody);
  if (!body.success) return { error: body.error.issues[0]?.message ?? "Check the email text." };

  const result = await approveAndCreateDraft(bulkOrderId, actor.actorId, { emailBody: body.data });
  if (!result.ok) return toError(result);
  refresh();
  return { success: true, message: "Gmail draft created with the spreadsheet attached. Open Gmail, check it and press Send." };
}

export async function markSpreadsheetSentAction(bulkOrderId: string): Promise<SheetActionResult> {
  const actor = await staff(bulkOrderId);
  if ("error" in actor) return { error: actor.error };
  const result = await markSheetSent(bulkOrderId);
  if (!result.ok) return toError(result);

  // Sending the order is what "placed with supplier" means, so move the
  // bulk order on and let new orders start the next one.
  const bulk = await getBulkOrderSummary(bulkOrderId);
  if (bulk?.status === "collecting") {
    const advanced = await advanceStatus(bulkOrderId, "placed");
    if (advanced.error) {
      refresh();
      return { success: true, message: "Marked as sent, but the bulk order status did not change: " + advanced.error };
    }
  }
  refresh();
  return { success: true, message: "Marked as sent. New orders will go into the next bulk order." };
}

export async function getSpreadsheetDownloadAction(bulkOrderId: string): Promise<SheetActionResult> {
  const actor = await staff(bulkOrderId);
  if ("error" in actor) return { error: actor.error };
  const result = await getSheetDownloadUrl(bulkOrderId);
  if (!result.ok) return toError(result);
  return { success: true, message: "Download starting.", url: result.data };
}
