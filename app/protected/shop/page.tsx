import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, LayoutGrid, Info, ArrowUp, ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCartCount } from "./actions/cart";
import { BulkOrderProgress } from "./components/BulkOrderProgress";
import { SortSelect } from "./components/SortSelect";
import { Pagination } from "./components/Pagination";
import { ProductCard } from "./components/ProductCard";
import { BrowseCards } from "./components/BrowseCards";
import {
  GENERAL,
  GENERAL_LABEL,
  SECTIONS,
  WEAPON_LABELS,
  findSection,
  groupProducts,
  isShopWeapon,
} from "@/lib/shop/browse";

const SORTS: Record<string, { column: string; ascending: boolean; label: string }> = {
  code: { column: "item_code", ascending: true, label: "Item code" },
  name: { column: "name", ascending: true, label: "Name (A to Z)" },
  "price-low": { column: "price", ascending: true, label: "Price (low first)" },
  "price-high": { column: "price", ascending: false, label: "Price (high first)" },
};

// Products per page: eight rows of three on desktop.
const PAGE_SIZE = 24;

/**
 * /protected/shop: the catalogue. Browse by section, then weapon, or
 * search, with sorting and pagination. Reads products directly with the
 * Supabase client (an existing exception to the layered pattern).
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    favourites?: string;
    page?: string;
    section?: string;
    weapon?: string;
    view?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const cartCount = await getCartCount();

  // Fetch this member's saved products so each card knows whether to show
  // a filled heart. One query for the page rather than one per product.
  const { data: auth } = await supabase.auth.getUser();
  const { data: favRows } = auth?.user
    ? await supabase
        .from("favourites")
        .select("product_id")
        .eq("user_id", auth.user.id)
    : { data: [] };

  // A Set makes "is this product saved?" fast, and we ask that 204 times.
  const favouriteIds = new Set((favRows ?? []).map((f) => f.product_id));

  // Everything the member has selected lives in the web address.
  const term = sp.q?.trim().replace(/[,()*]/g, "") ?? "";
  const category = sp.category ?? "";
  const sortKey = sp.sort ?? "code";
  const favouritesOnly = sp.favourites === "1";
  const sort = SORTS[sortKey] ?? SORTS.code;
  // Anything that is not a whole page number counts as page 1.
  const requestedPage = Number(sp.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;

  // One light query for the section and weapon of every product. It feeds
  // the counts on the browse cards, the sidebar and the total.
  const { data: tagRows } = await supabase.from("products").select("section, weapon");
  const rows = tagRows ?? [];
  const totalCount = rows.length;
  const sectionCount = (key: string) => rows.filter((r) => r.section === key).length;

  // With nothing searched or filtered, the shop asks one thing at a time:
  // section, then weapon (weapons and parts only), then the products. Every
  // step is its own address, so the breadcrumbs and the browser's back and
  // forward buttons walk through the choices. Search, favourites and "all
  // products" show a flat list instead.
  const section = findSection(sp.section);
  const weaponParam = sp.weapon ?? "";
  const viewAll = sp.view === "all";
  const browsing = !term && !category && !favouritesOnly && !viewAll;
  const browseView = browsing ? await renderBrowse() : null;

  async function renderBrowse() {
    if (!section) {
      const items = SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        count: sectionCount(s.key),
        href: "/protected/shop?section=" + s.key,
        imageSrc: "/media/shop/" + s.key.replace("_", "-") + ".jpg",
      })).filter((item) => item.count > 0);
      return (
        <BrowseStep crumbs={[]} title="Shop by section" favourites={favouriteIds.size}>
          <BrowseCards items={items} />
        </BrowseStep>
      );
    }

    const sectionHref = "/protected/shop?section=" + section.key;
    const weaponChosen = isShopWeapon(weaponParam) || weaponParam === GENERAL;

    if (section.asksForWeapon && !weaponChosen) {
      const inSection = rows.filter((r) => r.section === section.key);
      // A weapon's count includes the parts that fit any weapon, because
      // those show on its page too.
      const weapons = (["foil", "epee", "sabre"] as const).map((w) => ({
        key: w,
        label: WEAPON_LABELS[w],
        count: inSection.filter((r) => r.weapon === w || !r.weapon).length,
        href: sectionHref + "&weapon=" + w,
        imageSrc: "/media/shop/" + w + ".jpg",
      }));
      const items = [
        ...weapons,
        {
          key: GENERAL,
          label: GENERAL_LABEL,
          count: inSection.filter((r) => !r.weapon).length,
          href: sectionHref + "&weapon=" + GENERAL,
          // general.jpg shows masks and kit, which reads wrong next to the
          // pommels and nuts that end up here, so reuse the section's photo.
          imageSrc: "/media/shop/" + section.key.replace("_", "-") + ".jpg",
        },
      ].filter((item) => item.count > 0);
      return (
        <BrowseStep
          crumbs={[{ label: section.label }]}
          title={section.label}
          subtitle="Which weapon is it for?"
          favourites={favouriteIds.size}
        >
          <BrowseCards items={items} />
        </BrowseStep>
      );
    }

    let listQuery = supabase
      .from("products")
      .select("id, item_code, name, price, sizes, needs_handedness, image_path, kind, level")
      .eq("section", section.key);
    let weaponLabel = "";
    let listHref = sectionHref;
    if (section.asksForWeapon) {
      listHref += "&weapon=" + weaponParam;
      if (weaponParam === GENERAL) {
        listQuery = listQuery.is("weapon", null);
        weaponLabel = GENERAL_LABEL;
      } else {
        // weaponParam passed isShopWeapon above, so it is safe in the filter.
        // Parts that fit any weapon belong on every weapon's page.
        listQuery = listQuery.or(`weapon.eq.${weaponParam},weapon.is.null`);
        weaponLabel = WEAPON_LABELS[weaponParam as keyof typeof WEAPON_LABELS];
      }
    }
    // The groups keep this order, so sorting applies inside each group.
    const { data: list, error: listError } = await listQuery
      .order(sort.column, { ascending: sort.ascending })
      .order("id");
    if (listError) {
      return <p className="p-8 text-destructive">Failed to load: {listError.message}</p>;
    }

    const groups = groupProducts(list ?? []);
    const crumbs = weaponLabel
      ? [{ label: section.label, href: sectionHref }, { label: weaponLabel }]
      : [{ label: section.label }];
    const browseSorts = Object.keys(SORTS).map((k) => ({
      key: k,
      label: SORTS[k].label,
      href: k === "code" ? listHref : listHref + "&sort=" + k,
    }));
    return (
      <BrowseStep
        crumbs={crumbs}
        title={weaponLabel ? section.label + " - " + weaponLabel : section.label}
        favourites={favouriteIds.size}
        toolbar={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <SortSelect value={sortKey} options={browseSorts} />
          </div>
        }
      >
        {groups.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card/80 p-8 text-center text-muted-foreground backdrop-blur-sm">
            No products here yet.
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label} <span className="font-normal">({group.items.length})</span>
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((p) => (
                    <ProductCard key={p.id} product={p} isFavourite={favouriteIds.has(p.id)} titleAs="h4" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </BrowseStep>
    );
  }

  // Build the product query in pieces — each filter is optional.
  let query = supabase
    .from("products")
    .select("id, item_code, name, price, category, sizes, needs_handedness, image_path", {
      count: "exact",
    });

  if (category) {
    query = query.eq("category", category);
  }

  // Limit to saved products if that's what they asked for.
  if (favouritesOnly) {
    const ids = Array.from(favouriteIds);
    // -1 matches nothing, so an empty favourites list shows an empty page
    // rather than the whole catalogue.
    query = query.in("id", ids.length > 0 ? ids : [-1]);
  }

  if (term) {
    query = query.or(`item_code.ilike.%${term}%,name.ilike.%${term}%`);
  }

  // Only fetch the products for this page; count still covers every match.
  const from = (page - 1) * PAGE_SIZE;
  query = query
    .order(sort.column, { ascending: sort.ascending })
    .range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await query;

  // Asking for rows past the end is an error from the database, so an
  // out-of-date page link starts again from page 1.
  if (error?.code === "PGRST103" && page > 1) {
    redirect(linkTo({ page: "" }));
  }

  if (error) {
    return <p className="p-8 text-destructive">Failed to load: {error.message}</p>;
  }

  const products = data ?? [];
  const matchCount = count ?? products.length;
  const pageCount = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));

  // A page past the end (an old link, or a typed address) goes to the last page.
  if (page > pageCount) {
    redirect(linkTo({ page: pageCount > 1 ? String(pageCount) : "" }));
  }

  // Builds a link that keeps everything currently selected and changes
  // only the one thing passed in. Any other change starts again at page 1.
  function linkTo(changes: Record<string, string>) {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (category) params.set("category", category);
    if (sortKey !== "code") params.set("sort", sortKey);
    if (favouritesOnly) params.set("favourites", "1");
    if (viewAll) params.set("view", "all");

    if (changes.page && changes.page !== "1") params.set("page", changes.page);

    for (const key in changes) {
      if (key === "page") continue;
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

  // The sidebar leads back into the section-by-section browse rather than
  // the supplier's own category list.
  const sidebarItems = SECTIONS.filter((s) => sectionCount(s.key) > 0).map(function (s) {
    return (
      <Link
        key={s.key}
        href={"/protected/shop?section=" + s.key}
        className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm text-foreground transition hover:bg-accent"
      >
        <span>{s.label}</span>
        <span className="text-muted-foreground">{sectionCount(s.key)}</span>
      </Link>
    );
  });

  const listTitle = favouritesOnly
    ? "My favourites"
    : term
      ? `Results for "${term}"`
      : category || "All products";

  const cards = products.map((p) => (
    <ProductCard key={p.id} product={p} isFavourite={favouriteIds.has(p.id)} />
  ));

  return (
    <div className="relative">
      {/* Faded fencer behind the page. */}
      <Image
        src="/media/pages/cfa-side-profile-transparent.png"
        width={900}
        height={600}
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
            Cart ({cartCount})
          </Link>
        </div>
      </div>

      <BulkOrderProgress />

      {/* A plain form — submitting puts the search in the web address,
          which reruns this page with the filter applied. */}
      <form className="mb-6 flex items-center gap-2 rounded-2xl border border-border bg-card/80 p-2 backdrop-blur-sm">
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          name="q"
          defaultValue={term}
          placeholder="Search by item code or name..."
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <input type="hidden" name="category" value={category} />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 sm:px-6"
        >
          Search
        </button>
      </form>

      {browseView ?? (
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-2xl border border-border bg-card/80 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2 px-1">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium text-card-foreground">Browse</p>
          </div>

          <div className="space-y-0.5">
            {/* Saved products. Clicking again clears the filter. */}
            <Link
              href={
                favouritesOnly
                  ? linkTo({ favourites: "" })
                  : "/protected/shop?favourites=1"
              }
              className={
                "mb-1 flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition " +
                (favouritesOnly
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-foreground hover:bg-accent")
              }
            >
              <span>My favourites</span>
              <span
                className={favouritesOnly ? "opacity-70" : "text-muted-foreground"}
              >
                {favouriteIds.size}
              </span>
            </Link>

            <Link
              href="/protected/shop?view=all"
              className={
                "flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition " +
                (category || !viewAll
                  ? "text-foreground hover:bg-accent"
                  : "bg-primary font-medium text-primary-foreground")
              }
            >
              <span>All products</span>
              <span className={category || !viewAll ? "text-muted-foreground" : "opacity-70"}>
                {totalCount}
              </span>
            </Link>

            <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sections
            </p>
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
              <nav aria-label="Breadcrumb" className="mb-1 text-sm text-muted-foreground">
                <Link href="/protected/shop" className="hover:underline">Shop</Link>
                {" / "}
                <span aria-current="page" className="text-foreground">{listTitle}</span>
              </nav>
              <h2 className="text-xl font-semibold text-foreground">
                {listTitle}{" "}
                <span className="text-muted-foreground">({matchCount})</span>
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {pageCount > 1
                  ? "Showing " + (from + 1) + "-" + (from + products.length) + " of " + matchCount
                  : "High-quality fencing equipment for every stage of your journey."}
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
              {favouritesOnly
                ? "You have not saved any products yet."
                : "No products match."}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards}
          </div>

          <Pagination
            current={page}
            total={pageCount}
            href={(p) => linkTo({ page: String(p) })}
          />
        </section>
      </div>
      )}
    </div>
  );
}

// Frame for one browse step: breadcrumbs, title, toolbar and the content below.
function BrowseStep({
  crumbs,
  title,
  subtitle,
  favourites,
  toolbar,
  children,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  subtitle?: string;
  favourites: number;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-1 text-sm text-muted-foreground">
              <Link href="/protected/shop" className="hover:underline">Shop</Link>
              {crumbs.map((crumb) => (
                <span key={crumb.label}>
                  {" / "}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:underline">{crumb.label}</Link>
                  ) : (
                    <span aria-current="page" className="text-foreground">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {toolbar}
          <Link href="/protected/shop?favourites=1" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            My favourites ({favourites})
          </Link>
          <Link href="/protected/shop?view=all" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            See all products
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}