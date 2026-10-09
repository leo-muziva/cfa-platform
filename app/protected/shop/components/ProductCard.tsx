import Image from "next/image";
import Link from "next/link";
import { QuickAddButton } from "./QuickAddButton";
import { FavouriteButton } from "./FavouriteButton";
import { productImageUrl } from "@/lib/productImage";
import { formatRands } from "@/lib/money";

export interface ShopCardProduct {
  id: number;
  item_code: string;
  name: string;
  price: number | string;
  sizes: string | null;
  needs_handedness: boolean | null;
  image_path: string | null;
}

export function ProductCard({
  product: p,
  isFavourite,
  titleAs: Title = "h3",
}: {
  product: ShopCardProduct;
  isFavourite: boolean;
  // Sits under the list heading (h2), or under a group heading (h3) when browsing.
  titleAs?: "h3" | "h4";
}) {
  const imageUrl = productImageUrl(p.image_path);
  const hasSizes = Boolean(p.sizes);
  // Sizes and weapon hand are chosen on the detail page.
  const needsChoice = hasSizes || Boolean(p.needs_handedness);
  const href = "/protected/shop/" + p.item_code;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition hover:border-foreground/30 hover:shadow-sm">
      <Link href={href} className="block">
        <div className="relative flex h-40 items-center justify-center bg-white">
          <span className="absolute left-3 top-3 z-10 rounded-lg bg-background/90 px-2.5 py-1 font-mono text-xs text-muted-foreground shadow-sm">
            {p.item_code}
          </span>

          {/* Heart sits top-right, opposite the item code. */}
          <FavouriteButton productId={p.id} initiallyFavourite={isFavourite} />

          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={p.name}
              fill
              className="object-contain p-6"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          ) : (
            <span className="text-xs text-muted-foreground">No image</span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={href}>
          <Title className="text-sm font-medium leading-snug text-card-foreground hover:underline">{p.name}</Title>
        </Link>

        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className="text-lg font-semibold text-card-foreground">
              {Number(p.price) === 0 ? "Price on request" : formatRands(p.price)}
            </p>
            <span className="mt-1.5 inline-block rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {hasSizes ? "Multiple sizes" : "One size"}
            </span>
          </div>

          {/* Products with a size or hand to choose must open the page.
              Everything else can be added straight from here. */}
          {needsChoice ? (
            <Link
              href={href}
              className="shrink-0 rounded-xl border border-border px-3 py-2.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground"
            >
              {hasSizes ? "Choose size" : "Choose hand"}
            </Link>
          ) : (
            <QuickAddButton productId={p.id} />
          )}
        </div>
      </div>
    </div>
  );
}