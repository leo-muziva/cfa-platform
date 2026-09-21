import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "../ProductForm";

export default async function NewProductPage() {
  const supabase = await createClient();

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
        <h1 className="mt-2 text-2xl font-bold">Add product</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}