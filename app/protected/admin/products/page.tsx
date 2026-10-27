import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRands } from "@/lib/money";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/**
 * /protected/admin/products: the shop catalogue with search and filters.
 * Reads products directly with the Supabase client rather than through a
 * repository (an existing exception to the layered pattern).
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const search = sp.search?.trim().replace(/[,()*]/g, "") ?? "";
  const category = sp.category ?? "";
  const status = sp.status ?? "";

  // Category list for the filter dropdown.
  const { data: allCats } = await supabase.from("products").select("category");
  const categories = Array.from(
    new Set((allCats ?? []).map((r) => r.category).filter(Boolean))
  ).sort() as string[];

  let query = supabase
    .from("products")
    .select("id, item_code, name, price, category, sizes, is_active")
    .order("item_code");

  if (search) {
    query = query.or(`item_code.ilike.%${search}%,name.ilike.%${search}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (status === "active") {
    query = query.eq("is_active", true);
  }
  if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  const { data, error } = await query;

  if (error) {
    return <p className="text-destructive">Failed to load: {error.message}</p>;
  }

  const products = data ?? [];
  const hasFilters = Boolean(search || category || status);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the equipment catalogue ({products.length})
          </p>
        </div>
        <Button asChild>
          <Link href="/protected/admin/products/new">Add product</Link>
        </Button>
      </div>

      <form
        method="GET"
        className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            name="search"
            type="search"
            placeholder="Item code or name"
            defaultValue={search}
            maxLength={100}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className={selectClasses}
          >
            <option value="">All categories</option>
            {categories.map(function (c) {
              return (
                <option key={c} value={c}>
                  {c}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className={selectClasses}
          >
            <option value="">All statuses</option>
            <option value="active">In the shop</option>
            <option value="inactive">Hidden</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {hasFilters ? (
            <Button variant="outline" asChild>
              <Link href="/protected/admin/products">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
          <CardDescription>
            {products.length === 0
              ? "No products match"
              : "Showing " + products.length + " products"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {hasFilters
                ? "No products match the current filters."
                : "No products yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Sizes
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(function (p) {
                    return (
                      <tr
                        key={p.id}
                        className="border-b transition-colors last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-6 py-3 font-mono text-xs">
                          <Link
                            href={"/protected/admin/products/" + p.id}
                            className="underline-offset-4 hover:underline"
                          >
                            {p.item_code}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={"/protected/admin/products/" + p.id}
                            className="underline-offset-4 hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.category ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {Number(p.price) === 0
                            ? "On request"
                            : formatRands(p.price)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.sizes ?? "One size"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.is_active ? "default" : "outline"}>
                            {p.is_active ? "In shop" : "Hidden"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}