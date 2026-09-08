import { createClient } from "@/lib/supabase/server";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const term = q?.trim().replace(/[,()*]/g, "") ?? "";

  let query = supabase
    .from("products")
    .select("id, item_code, name, description, price, image_path")
    .order("item_code");

  if (term) {
    query = query.or(`item_code.ilike.%${term}%,name.ilike.%${term}%`);
  }

  const { data: products, error } = await query;

  if (error) {
    return (
      <p className="p-8 text-red-600">
        Failed to load catalogue: {error.message}
      </p>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Equipment Catalogue</h1>

      <form className="mb-6 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={term}
          placeholder="Search by item code or name (e.g. EF105)"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
          Search
        </button>
      </form>

      {term ? (
        <p className="mb-4 text-sm text-gray-600">
          {products?.length ?? 0} results for {term} —{" "}
          <a href="/shop" className="underline">
            clear
          </a>
        </p>
      ) : null}

      {products?.length === 0 ? (
        <p className="text-gray-500">
          {term ? "No products match that search." : "No products yet."}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map(function (p) {
           return (

            <a
                key={p.id}
                href={"/shop/" + p.item_code}
                className="rounded-lg border p-4 transition hover:border-black"
           >




              <p className="font-mono text-xs text-gray-500">{p.item_code}</p>
              <h2 className="font-medium">{p.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                {p.description}
              </p>
              <p className="mt-2 font-semibold">
                R{Number(p.price).toFixed(2)}
              </p>
            </a>
          );
        })}
      </div>
    </main>
  );
}