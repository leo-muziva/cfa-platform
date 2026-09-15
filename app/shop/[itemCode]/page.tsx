import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AddToCartButton } from "../components/AddToCartButton";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ itemCode: string }>;
}) {
  const { itemCode } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, item_code, name, description, price, image_path, sizes")
    .eq("item_code", itemCode.toUpperCase())
    .single();

  if (!product) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
           <div className="flex items-center justify-between">
        <a href="/shop" className="text-sm text-gray-500 underline">
          Back to catalogue
        </a>
        <a href="/shop/cart" className="text-sm underline">
          View order
        </a>
      </div>

      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-lg border bg-gray-50">
          <span className="text-sm text-gray-400">No image</span>
        </div>

        <div>
          <p className="font-mono text-sm text-gray-500">{product.item_code}</p>
          <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
          <p className="mt-4 text-xl font-semibold">
            {Number(product.price) === 0
              ? "Price on request"
              : "R" + Number(product.price).toFixed(2)}
          </p>
          <p className="mt-4 whitespace-pre-line text-gray-700">
            {product.description}
          </p>

          <AddToCartButton productId={product.id} sizes={product.sizes} />
        </div>
      </div>
    </main>
  );
}