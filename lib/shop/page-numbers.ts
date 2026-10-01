export type PageItem = number | "gap";

/**
 * Page links to show, Google style: always the first and last page, plus the
 * current page and one either side, with a gap wherever pages are skipped.
 * A gap that would hide a single page shows that page instead.
 */
export function pageNumbers(current: number, total: number): PageItem[] {
  if (total <= 1) return total === 1 ? [1] : [];

  const shown = new Set([1, total, current - 1, current, current + 1]);
  const pages = Array.from(shown)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  for (const page of pages) {
    const previous = items[items.length - 1];
    if (typeof previous === "number" && page - previous === 2) items.push(previous + 1);
    else if (typeof previous === "number" && page - previous > 2) items.push("gap");
    items.push(page);
  }
  return items;
}
