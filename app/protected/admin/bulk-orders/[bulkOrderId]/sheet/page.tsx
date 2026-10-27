import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { requireAdmin } from "@/lib/services/MemberService";
import { getSheetDownloadUrl, getSheetPreview } from "@/lib/services/supplier-sheet-service";
import { bulkOrderIdSchema } from "@/lib/validations/bulk-order.schema";

export const dynamic = "force-dynamic";

// Shows the saved supplier spreadsheet as tables, so staff can check it
// without Excel. The Excel file is still what goes to the supplier.
export default async function SupplierSheetPreviewPage({ params }: { params: Promise<{ bulkOrderId: string }> }) {
  const admin = await requireAdmin();
  if ("error" in admin) redirect(admin.error === "Not authenticated" ? "/auth/login?next=/protected/admin/bulk-orders" : "/protected");
  const { bulkOrderId } = await params;
  if (!bulkOrderIdSchema.safeParse(bulkOrderId).success) notFound();

  const [preview, download] = await Promise.all([getSheetPreview(bulkOrderId), getSheetDownloadUrl(bulkOrderId)]);
  if (!preview.ok) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-50">
          {preview.code === "no_sheet" ? "No spreadsheet has been generated for this bulk order yet." : "The spreadsheet could not be loaded. Try again in a moment."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{preview.data.fileName.replace(/\.xlsx$/, "")}</h1>
          <p className="text-sm text-muted-foreground">
            Bulk order {preview.data.reference}. This is the Excel file that is attached to the supplier email
            {preview.data.withNotes ? ", with the AI review notes added on a second sheet" : ""}.
          </p>
        </div>
        {download.ok && (
          <a href={download.data} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-muted">
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Excel file
          </a>
        )}
      </header>

      {preview.data.sheets.map((sheet) => (
        <section key={sheet.name} className="space-y-2">
          <h2 className="text-xl font-semibold">{sheet.name}</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {sheet.rows.map((row, r) => (
                  <tr key={r} className="border-b last:border-b-0 even:bg-muted/40">
                    {row.map((cell, c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-1.5 align-top">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

// Link back to the bulk orders page.
function BackLink() {
  return (
    <Link href="/protected/admin/bulk-orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Bulk orders
    </Link>
  );
}
