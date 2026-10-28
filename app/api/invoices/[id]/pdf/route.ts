// Downloads one invoice as a PDF. The payer gets their own invoices and staff
// get any invoice; everyone else gets a 404 so invoice ids reveal nothing.
import { NextResponse } from "next/server";
import { getInvoicePdf } from "@/lib/services/invoice-document-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getInvoicePdf(id);
  if (!result.ok) {
    return result.reason === "unauthenticated"
      ? NextResponse.json({ error: "Sign in to download invoices." }, { status: 401 })
      : NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  return new NextResponse(Buffer.from(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      // Invoices are personal financial records; never store them in shared caches.
      "Cache-Control": "private, no-store",
    },
  });
}
