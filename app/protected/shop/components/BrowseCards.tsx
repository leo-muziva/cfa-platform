import Link from "next/link";
import { ImageIcon } from "lucide-react";

// One clickable card in a browse step.
export interface BrowseCardItem {
  key: string;
  label: string;
  href: string;
  // A 16:9 photo from public/media/shop. Without one the card shows a
  // placeholder icon instead.
  imageSrc?: string;
}

/** The grid of section or weapon cards on the shop's browse steps. */
export function BrowseCards({ items }: { items: BrowseCardItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition hover:border-foreground/30 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <div className="flex aspect-[16/9] items-center justify-center bg-muted/60">
            {item.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon aria-hidden="true" className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
          <p className="p-4 text-center font-medium text-card-foreground group-hover:underline">{item.label}</p>
        </Link>
      ))}
    </div>
  );
}