import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AddToCartButton } from "../components/AddToCartButton";
import Image from "next/image";
import { productImageUrl } from "@/lib/productImage";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ itemCode: string }>;
}) {
  const { itemCode } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, item_code, name, description, price, image_path, sizes, needs_handedness")
    .eq("item_code", itemCode.toUpperCase())
    .single();

  if (!product) {
     
    notFound();
  }
   const imageUrl = productImageUrl(product.image_path);

  return (
    <main className="mx-auto max-w-3xl p-8">
           <div className="flex items-center justify-between">
        <Link href="/protected/shop" className="text-sm text-gray-500 underline dark:text-white/60">
          Back to catalogue
        </Link>
        <Link href="/protected/shop/cart" className="text-sm underline">
          View cart
        </Link>
      </div>

      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-white">          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
               
              className="object-contain p-4"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          ) : (
            <span className="text-sm text-gray-400">No image</span>
          )}
        </div>

        <div>
          <p className="font-mono text-sm text-gray-500 dark:text-white/60">{product.item_code}</p>
          <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
          <p className="mt-4 text-xl font-semibold">
            {Number(product.price) === 0
              ? "Price on request"
              : "R" + Number(product.price).toFixed(2)}
          </p>
          <p className="mt-4 whitespace-pre-line text-gray-700 dark:text-white/75">
            {product.description}
          </p>

          <AddToCartButton productId={product.id} sizes={product.sizes}  needsHandedness={product.needs_handedness} />
        </div>
      </div>
    </main>
  );
}
