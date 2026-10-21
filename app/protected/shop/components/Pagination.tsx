import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageNumbers } from "@/lib/shop/page-numbers";

// Numbered page links under the catalogue grid. Each page is its own web
// address, so links can be shared and the back button works.
export function Pagination({
  current,
  total,
  href,
}: {
  current: number;
  total: number;
  href: (page: number) => string;
}) {
  if (total <= 1) return null;

  const step =
    "flex h-10 items-center gap-1 rounded-xl px-3 text-sm";
  const number =
    "flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-sm";

  return (
    <nav
      aria-label="Catalogue pages"
      className="mt-8 flex flex-wrap items-center justify-center gap-1"
    >
      {current > 1 ? (
        <Link href={href(current - 1)} className={step + " text-foreground hover:bg-accent"}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
        </Link>
      ) : (
        <span aria-disabled="true" className={step + " text-muted-foreground opacity-50"}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
        </span>
      )}

      {pageNumbers(current, total).map((item, index) =>
        item === "gap" ? (
          <span key={"gap-" + index} aria-hidden="true" className={number + " text-muted-foreground"}>
            …
          </span>
        ) : item === current ? (
          <span
            key={item}
            aria-current="page"
            className={number + " bg-primary font-medium text-primary-foreground"}
          >
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-label={"Page " + item}
            className={number + " text-foreground hover:bg-accent"}
          >
            {item}
          </Link>
        ),
      )}

      {current < total ? (
        <Link href={href(current + 1)} className={step + " text-foreground hover:bg-accent"}>
          Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={step + " text-muted-foreground opacity-50"}>
          Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
