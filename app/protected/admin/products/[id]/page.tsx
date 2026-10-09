import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, item_code, name, description, price, category, sizes, section, weapon, kind, level, is_active")
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