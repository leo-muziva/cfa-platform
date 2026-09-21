import Image from "next/image";
import Link from "next/link";
import { Search, LayoutGrid, Info, ArrowUp, ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCartCount } from "./actions/cart";
import { BulkOrderProgress } from "./components/BulkOrderProgress";
import { QuickAddButton } from "./components/QuickAddButton";
import { SortSelect } from "./components/SortSelect";
import { productImageUrl } from "@/lib/productImage";

const SORTS: Record<string, { column: string; ascending: boolean; label: string }> = {
  code: { column: "item_code", ascending: true, label: "Item code" },
  name: { column: "name", ascending: true, label: "Name (A to Z)" },
  "price-low": { column: "price", ascending: true, label: "Price (low first)" },
  "price-high": { column: "price", ascending: false, label: "Price (high first)" },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const cartCount = await getCartCount();

  const term = sp.q?.trim().replace(/[,()*]/g, "") ?? "";
  const category = sp.category ?? "";
  const sortKey = sp.sort ?? "code";
  const sort = SORTS[sortKey] ?? SORTS.code;

  const { data: allCats } = await supabase.from("products").select("category");
  const counts: Record<string, number> = {};
  for (const row of allCats ?? []) {
    const c = row.category ?? "Uncategorised";
    counts[c] = (counts[c] ?? 0) + 1;
  }
  const categories = Object.keys(counts).sort();
  const totalCount = allCats?.length ?? 0;

  let query = supabase
    .from("products")
    .select("id, item_code, name, price, category, sizes, image_path");

  if (category) {
    query = query.eq("category", category);
  }
  if (term) {
    query = query.or(`item_code.ilike.%${term}%,name.ilike.%${term}%`);
  }
  query = query.order(sort.column, { ascending: sort.ascending });

  const { data, error } = await query;

  if (error) {
    return <p className="p-8 text-destructive">Failed to load: {error.message}</p>;
  }

  const products = data ?? [];

  function linkTo(changes: Record<string, string>) {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (category) params.set("category", category);
    if (sortKey !== "code") params.set("sort", sortKey);
    for (const key in changes) {
      if (changes[key]) {
        params.set(key, changes[key]);
      } else {
        params.delete(key);
      }
    }
    const s = params.toString();
    return s ? "/protected/shop?" + s : "/protected/shop";
  }

  const sortOptions = Object.keys(SORTS).map(function (k) {
    return { key: k, label: SORTS[k].label, href: linkTo({ sort: k }) };
  });

  const sidebarItems = categories.map(function (c) {
    const active = category === c;
    return (
      <Link
        key={c}
        href={linkTo({ category: c })}
        className={
          "flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition " +
          (active
            ? "bg-primary font-medium text-primary-foreground"
            : "text-foreground hover:bg-accent")
        }
      >
        <span>{c}</span>
        <span className={active ? "opacity-70" : "text-muted-foreground"}>
          {counts[c]}
        </span>
      </Link>
    );
  });

  const cards = products.map(function (p) {
    const imageUrl = productImageUrl(p.image_path);
    const hasSizes = Boolean(p.sizes);
    const href = "/protected/shop/" + p.item_code;

    return (
      <div
        key={p.id}
        className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition hover:border-foreground/30 hover:shadow-sm"
      >
        <Link href={href} className="block">
          <div className="relative flex h-40 items-center justify-center bg-muted">
            <span className="absolute left-3 top-3 z-10 rounded-lg bg-background/90 px-2.5 py-1 font-mono text-xs text-muted-foreground shadow-sm">
              {p.item_code}
            </span>
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={p.name}
                fill
                unoptimized
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
            <h2 className="text-sm font-medium leading-snug text-card-foreground hover:underline">
              {p.name}
            </h2>
          </Link>

          <div className="mt-auto flex items-end justify-between pt-3">
            <div>
              <p className="text-lg font-semibold text-card-foreground">
                {Number(p.price) === 0
                  ? "Price on request"
                  : "R" + Number(p.price).toFixed(2)}
              </p>
              <span className="mt-1.5 inline-block rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {hasSizes ? "Multiple sizes" : "One size"}
              </span>
            </div>

            {hasSizes ? (
              <Link
                href={href}
                className="shrink-0 rounded-xl border border-border px-3 py-2.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground"
              >
                Choose size
              </Link>
            ) : (
              <QuickAddButton productId={p.id} />
            )}
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="relative">
        <img
        src="/shop-hero.png"
        alt=""
        aria-hidden="true"
         style={{
          position: "absolute",
          top: 0,
          right: "-4rem",
          height: "100%",
          width: "60%",
          objectFit: "contain",
          objectPosition: "right top",
          opacity: 0.2,
          pointerEvents: "none",
          zIndex: 0,
        }}
        
        
        />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Equipment Catalogue
            </h1>
            <p className="mt-1 text-muted-foreground">
              Quality gear for a stronger community.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs uppercase tracking-[0.25em] text-muted-foreground sm:block">
              Equip &middot; Train &middot; Progress
            </p>
            <Link
              href="/protected/shop/orders"
              className="rounded-xl px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              My orders
            </Link>
            <Link
              href="/protected/shop/cart"
              className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              Order ({cartCount})
            </Link>
          </div>
        </div>

        <BulkOrderProgress />

        <form className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-card/80 p-2 backdrop-blur-sm">
          <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Search by item code or name..."
            className="flex-1 bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <input type="hidden" name="category" value={category} />
          <button
            type="submit"
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Search
          </button>
        </form>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-2xl border border-border bg-card/80 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2 px-1">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium text-card-foreground">Categories</p>
            </div>

            <div className="space-y-0.5">
              <Link
                href={linkTo({ category: "" })}
                className={
                  "flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition " +
                  (category
                    ? "text-foreground hover:bg-accent"
                    : "bg-primary font-medium text-primary-foreground")
                }
              >
                <span>All products</span>
                <span className={category ? "text-muted-foreground" : "opacity-70"}>
                  {totalCount}
                </span>
              </Link>
              {sidebarItems}
            </div>

            <div className="mt-4 flex gap-3 border-t border-border pt-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-card-foreground">Need help?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Talk to your coach about equipment sizing and recommendations.
                </p>
              </div>
            </div>
          </aside>

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {category || "All products"}{" "}
                  <span className="text-muted-foreground">({products.length})</span>
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  High-quality fencing equipment for every stage of your journey.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by</span>
                <SortSelect value={sortKey} options={sortOptions} />
                <Link
                  href={linkTo({ sort: "price-low" })}
                  className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  Price up <ArrowUp className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={linkTo({ sort: "price-high" })}
                  className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  Price down <ArrowDown className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {products.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card/80 p-8 text-center text-muted-foreground backdrop-blur-sm">
                No products match.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards}
            </div>
          </section>
        </div>
      </div>

  );
}