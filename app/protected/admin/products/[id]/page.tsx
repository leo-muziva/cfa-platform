import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../ProductForm";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photo?: string }>;
}) {
  const { id } = await params;
  // Set by the add form when the product saved but its photo did not.
  const photoFailed = (await searchParams).photo === "failed";
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, item_code, name, description, price, category, sizes, section, weapon, kind, level, is_active, image_path")
    .eq("id", Number(id))
    .single();

  if (!product) {
    notFound();
  }

  const { data: allCats } = await supabase.from("products").select("category");
  const categories = Array.from(
    new Set((allCats ?? []).map((r) => r.category).filter(Boolean))
  ).sort() as string[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/protected/admin/products"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{product.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">
          {product.item_code}
        </p>
      </div>

      {photoFailed ? (
        <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          The product was added, but its photo didn&apos;t upload. Choose the photo again below and save.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm product={product} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}