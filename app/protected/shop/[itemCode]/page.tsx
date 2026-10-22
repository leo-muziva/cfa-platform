import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AddToCartButton } from "../components/AddToCartButton";
import Image from "next/image";
import { productImageUrl } from "@/lib/productImage";
import { formatRands } from "@/lib/money";
import { GENERAL, GENERAL_LABEL, WEAPON_LABELS, findSection, isShopWeapon } from "@/lib/shop/browse";
import { sizeGuideHref } from "../size-guide/sizeGuide";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ itemCode: string }>;
}) {
  const { itemCode } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, item_code, name, description, price, image_path, sizes, needs_handedness, section, weapon")
    .eq("item_code", itemCode.toUpperCase())
    .single();

  if (!product) {
     
    notFound();
  }
   const imageUrl = productImageUrl(product.image_path);
   // Only show the size guide link where the product actually has sizes.
  const guideHref = product.sizes ? sizeGuideHref(product.name) : null;

  // Breadcrumbs back up the same steps the shop browse uses, so a member can
  // go back to the section or weapon this product sits in.
  const section = findSection(product.section ?? undefined);
  const crumbs: { label: string; href: string }[] = [];
  if (section) {
    const sectionHref = "/protected/shop?section=" + section.key;
    crumbs.push({ label: section.label, href: sectionHref });
    if (section.asksForWeapon) {
      const weapon = isShopWeapon(product.weapon ?? undefined) ? product.weapon : GENERAL;
      crumbs.push({
        label: weapon === GENERAL ? GENERAL_LABEL : WEAPON_LABELS[weapon as keyof typeof WEAPON_LABELS],
        href: sectionHref + "&weapon=" + weapon,
      });
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
           <div className="flex items-center justify-between">
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 dark:text-white/60">
          <Link href="/protected/shop" className="underline-offset-4 hover:underline">Shop</Link>
          {crumbs.map((crumb) => (
            <span key={crumb.href}>
              {" / "}
              <Link href={crumb.href} className="underline-offset-4 hover:underline">{crumb.label}</Link>
            </span>
          ))}
        </nav>
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
              : formatRands(product.price)}
          </p>
          <p className="mt-4 whitespace-pre-line text-gray-700 dark:text-white/75">
            {product.description}
          </p>


           {guideHref ? (
            <Link
              href={guideHref}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Size guide
            </Link>
          ) : null}

          <AddToCartButton productId={product.id} sizes={product.sizes}  needsHandedness={product.needs_handedness} />
        </div>
      </div>
    </main>
  );
}
