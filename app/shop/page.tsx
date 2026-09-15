
import { createClient } from "@/lib/supabase/server";
import { getCartCount } from "./actions/cart";


// The four ways products can be sorted.
// The key (e.g. "price-low") is what appears in the URL.
// "column" is which database column to sort by.
// "ascending: true" means smallest first, false means largest first.
const SORTS: Record<string, { column: string; ascending: boolean }> = {
  code: { column: "item_code", ascending: true },
  name: { column: "name", ascending: true },
  "price-low": { column: "price", ascending: true },
  "price-high": { column: "price", ascending: false },
};

export default async function ShopPage({
  searchParams,
}: {
  // Whatever is in the URL after the "?" arrives here.
  // e.g. /shop?q=mask&category=Masks&sort=price-low
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const sp = await searchParams; 
  const supabase = await createClient();
  const cartCount = await getCartCount();

  // Read the three URL values. If one is missing, use a sensible default.
  // The .replace strips characters that would confuse the database filter.
  const term = sp.q?.trim().replace(/[,()*]/g, "") ?? "";
  const category = sp.category ?? "";
  const sortKey = sp.sort ?? "code";
  const sort = SORTS[sortKey] ?? SORTS.code;

  // FIRST QUERY: get the category of every product, so we can count them
  // for the sidebar (Masks 17, Clothing 18, and so on).
  const { data: allCats } = await supabase.from("products").select("category");

  // Tally up how many products are in each category.
  const counts: Record<string, number> = {};
  for (const row of allCats ?? []) {
    const c = row.category ?? "Uncategorised";
    counts[c] = (counts[c] ?? 0) + 1;
  }
  const categories = Object.keys(counts).sort();
  const totalCount = allCats?.length ?? 0;

  // SECOND QUERY: the products to actually display.
  // We build this up in pieces — start broad, then narrow it down.
  let query = supabase
    .from("products")
    .select("id, item_code, name, description, price, category, sizes");

  // Only add a category filter if a category was chosen.
  if (category) {
    query = query.eq("category", category);
  }

  // Only add a search filter if something was typed.
  // "or" means: match the item code OR the name.
  // "ilike" means case-insensitive, and the % signs mean "anywhere in the text".
  if (term) {
    query = query.or(`item_code.ilike.%${term}%,name.ilike.%${term}%`);
  }

  // Apply whichever sort was chosen.
  query = query.order(sort.column, { ascending: sort.ascending });

  // Now actually run it.
  const { data, error } = await query;

  if (error) {
    return <p className="p-8 text-red-600">Failed to load: {error.message}</p>;
  }

  const products = data ?? [];

  // Builds the URL for a link, keeping everything the user has already chosen.
  // Without this, clicking a category would wipe out their search.
  // You pass in only the thing you want to change, e.g. { category: "Masks" }.
  function linkTo(changes: Record<string, string>) {
    const params = new URLSearchParams();

    // Start with what's currently selected.
    if (term) params.set("q", term);
    if (category) params.set("category", category);
    if (sortKey !== "code") params.set("sort", sortKey);

    // Then apply the change. An empty value removes it (used by "All products").
    for (const key in changes) {
      if (changes[key]) {
        params.set(key, changes[key]);
      } else {
        params.delete(key);
      }
    }

    const s = params.toString();
    return s ? "/shop?" + s : "/shop";
  }

  // Build one sidebar link per category.
  const sidebarItems = categories.map(function (c) {
    const active = category === c;
    return (
      <a
        key={c}
        href={linkTo({ category: c })}
        className={
          // The selected category gets a dark background.
          "flex items-center justify-between rounded px-3 py-2 text-sm " +
          (active ? "bg-gray-900 text-white" : "hover:bg-gray-100")
        }
      >
        <span>{c}</span>
        <span className={active ? "text-gray-300" : "text-gray-400"}>
          {counts[c]}
        </span>
      </a>
    );
  });

  // Build one card per product.
  const cards = products.map(function (p) {
    return (
      <a
        key={p.id}
        href={"/shop/" + p.item_code}
        className="rounded-lg border p-4 transition hover:border-black"
      >
        <p className="font-mono text-xs text-gray-500">{p.item_code}</p>
        <h2 className="mt-1 text-sm font-medium">{p.name}</h2>
        <p className="mt-2 font-semibold">
          {/* Five scoring machines have no price yet, so show text instead of R0.00 */}
          {Number(p.price) === 0
            ? "Price on request"
            : "R" + Number(p.price).toFixed(2)}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          {/* The sizes column is empty for now, so everything says "One size" */}
          {p.sizes ? "Multiple sizes" : "One size"}
        </p>
      </a>
    );
  });

  return (
    <main className="mx-auto max-w-6xl p-8">
            <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Equipment Catalogue</h1>
        <div className="flex items-center gap-4 text-sm">
          <a href="/shop/orders" className="underline">
            My orders
          </a>
          <a
            href="/shop/cart"
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Order ({cartCount})
          </a>
        </div>
      </div>


      {/* A plain HTML form. Submitting it puts "?q=whatever" in the URL,
          which reruns this whole page with the search applied. No JavaScript needed. */}
      <form className="mb-6 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={term}
          placeholder="Search by item code or name"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        {/* Carries the current category through the search,
            so searching inside Masks doesn't kick you back to all products. */}
        <input type="hidden" name="category" value={category} />
        <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
          Search
        </button>
      </form>

      {/* Two columns on desktop: 220px sidebar, products fill the rest.
          Stacks vertically on mobile. */}
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside>
          <p className="mb-2 text-sm font-medium">Categories</p>

          {/* Passing an empty category clears the filter. */}
          <a
            href={linkTo({ category: "" })}
            className={
              "flex items-center justify-between rounded px-3 py-2 text-sm " +
              (category ? "hover:bg-gray-100" : "bg-gray-900 text-white")
            }
          >
            <span>All products</span>
            <span className={category ? "text-gray-400" : "text-gray-300"}>
              {totalCount}
            </span>
          </a>

          {sidebarItems}
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {category || "All products"} ({products.length})
            </p>

            {/* Each sort link keeps the current category and search. */}
            <div className="flex gap-2 text-sm">
              <a href={linkTo({ sort: "code" })} className="underline">
                Code
              </a>
              <a href={linkTo({ sort: "name" })} className="underline">
                Name
              </a>
              <a href={linkTo({ sort: "price-low" })} className="underline">
                Price up
              </a>
              <a href={linkTo({ sort: "price-high" })} className="underline">
                Price down
              </a>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="text-gray-500">No products match.</p>
          ) : null}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{cards}</div>
        </section>
      </div>
    </main>
  );
}