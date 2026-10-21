// Pure CSV builders for bulk-order exports. They take plain rows so the
// grouping and formatting rules can be tested without a database.

export type Handedness = "right" | "left";

export interface ExportItem {
  itemCode: string;
  name: string;
  size: string | null;
  handedness: Handedness | null;
  quantity: number;
  unitPrice: number;
  category?: string | null;
}

export interface ExportCustomer {
  fullName: string | null;
  email: string | null;
  phone: string | null;
}

export interface ExportOrder {
  status: string;
  customer: ExportCustomer | null;
  items: ExportItem[];
}

export interface SupplierLine {
  itemCode: string;
  name: string;
  size: string;
  hand: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  category: string;
}

// Only verified payments go to the supplier. Legacy 'submitted' orders were
// attached to bulk orders without ever being paid, so they are left out.
export function isExportableOrder(order: ExportOrder): boolean {
  return order.status === "paid";
}

export function handLabel(handedness: Handedness | null): string {
  if (handedness === "right") return "RH";
  if (handedness === "left") return "LH";
  return "";
}

// Wraps a value in quotes if it contains a comma, quote or line break.
export function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCents(rands: number): number {
  return Math.round(rands * 100);
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

// One supplier line per item code, size, hand and price. A right-handed and
// a left-handed glove are different stock, so they must never merge.
export function groupSupplierLines(orders: ExportOrder[]): SupplierLine[] {
  const lines = new Map<string, SupplierLine>();

  for (const order of orders.filter(isExportableOrder)) {
    for (const item of order.items) {
      const size = item.size ?? "";
      const hand = handLabel(item.handedness);
      const unitPriceCents = toCents(item.unitPrice);
      const key = [item.itemCode, size, hand, unitPriceCents].join("|");
      const existing = lines.get(key);

      if (existing) {
        existing.quantity += item.quantity;
        existing.lineTotalCents += unitPriceCents * item.quantity;
      } else {
        lines.set(key, {
          itemCode: item.itemCode,
          name: item.name,
          size,
          hand,
          quantity: item.quantity,
          unitPriceCents,
          lineTotalCents: unitPriceCents * item.quantity,
          category: item.category ?? "",
        });
      }
    }
  }

  return Array.from(lines.values()).sort(function (a, b) {
    return (
      a.itemCode.localeCompare(b.itemCode) ||
      a.size.localeCompare(b.size) ||
      a.hand.localeCompare(b.hand) ||
      a.unitPriceCents - b.unitPriceCents
    );
  });
}

export function buildSupplierCsv(orders: ExportOrder[]): string {
  const lines = groupSupplierLines(orders);
  const rows = ["Item Code,Description,Size,Hand,Quantity,Unit Price,Line Total"];
  let totalCents = 0;

  for (const l of lines) {
    totalCents += l.lineTotalCents;
    rows.push(
      [
        csvCell(l.itemCode),
        csvCell(l.name),
        csvCell(l.size),
        csvCell(l.hand),
        csvCell(l.quantity),
        csvCell(formatCents(l.unitPriceCents)),
        csvCell(formatCents(l.lineTotalCents)),
      ].join(",")
    );
  }

  rows.push(",,,,,,");
  rows.push(",,,,,Total," + formatCents(totalCents));
  return rows.join("\n");
}

// CFA's packing list: one line per customer per item, for sorting the
// shipment when it arrives.
export function buildDistributionCsv(orders: ExportOrder[]): string {
  const rows = [
    "Customer,Email,Phone,Item Code,Description,Size,Hand,Quantity,Unit Price,Line Total",
  ];

  for (const order of orders.filter(isExportableOrder)) {
    for (const item of order.items) {
      const unitPriceCents = toCents(item.unitPrice);
      rows.push(
        [
          csvCell(order.customer?.fullName ?? ""),
          csvCell(order.customer?.email ?? ""),
          csvCell(order.customer?.phone ?? ""),
          csvCell(item.itemCode),
          csvCell(item.name),
          csvCell(item.size ?? ""),
          csvCell(handLabel(item.handedness)),
          csvCell(item.quantity),
          csvCell(formatCents(unitPriceCents)),
          csvCell(formatCents(unitPriceCents * item.quantity)),
        ].join(",")
      );
    }
  }

  return rows.join("\n");
}
