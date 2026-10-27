"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KIND_LABELS, LEVEL_LABELS, SECTIONS, WEAPON_LABELS } from "@/lib/shop/browse";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductInput,
} from "./actions";

// A product as loaded for editing. Browse fields are optional because older
// rows may not have them yet.
export type ProductRow = {
  id: number;
  item_code: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  sizes: string | null;
  section?: string | null;
  weapon?: string | null;
  kind?: string | null;
  level?: string | null;
  is_active: boolean;
};

/** The add and edit product form. Saves through the createProduct or updateProduct actions. */
export function ProductForm({
  product,
  categories,
}: {
  product?: ProductRow;
  categories: string[];
}) {
  const router = useRouter();
  const editing = Boolean(product);

  const [form, setForm] = useState<ProductInput>({
    item_code: product?.item_code ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "0",
    category: product?.category ?? "",
    sizes: product?.sizes ?? "",
    section: product?.section ?? "",
    weapon: product?.weapon ?? "",
    kind: product?.kind ?? "",
    level: product?.level ?? "",
    is_active: product?.is_active ?? true,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Updates one field without disturbing the rest.
  function set(field: keyof ProductInput, value: string | boolean) {
    setForm(function (f) {
      return { ...f, [field]: value };
    });
  }

  async function save() {
    setBusy(true);
    setError("");

    const result = editing
      ? await updateProduct(product!.id, form)
      : await createProduct(form);

    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/protected/admin/products");
    router.refresh();
  }

  async function remove() {
    if (!product) return;
    setBusy(true);
    setError("");

    const result = await deleteProduct(product.id);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/protected/admin/products");
    router.refresh();
  }

  const selectClasses =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="item_code">Item code</Label>
        <Input
          id="item_code"
          value={form.item_code}
          onChange={function (e) {
            set("item_code", e.target.value);
          }}
          placeholder="EF105"
        />
        <p className="text-xs text-muted-foreground">
          The supplier&apos;s code. Customers search by this, so it must be unique.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">Product name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={function (e) {
            set("name", e.target.value);
          }}
          placeholder="Sabre Mask (CE350N)"
        />
      </div>

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          rows={3}
          value={form.description}
          onChange={function (e) {
            set("description", e.target.value);
          }}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Optional. Shown on the product page."
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="price">Price (R)</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min="0"
          value={form.price}
          onChange={function (e) {
            set("price", e.target.value);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Leave as 0 to show &ldquo;Price on request&rdquo;.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <input
          id="category"
          list="category-options"
          value={form.category}
          onChange={function (e) {
            set("category", e.target.value);
          }}
          className={selectClasses}
          placeholder="Masks"
        />
        <datalist id="category-options">
          {categories.map(function (c) {
            return <option key={c} value={c} />;
          })}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Pick an existing one or type a new one.
        </p>
      </div>

      <ChoiceField
        id="section"
        label="Shop section"
        value={form.section ?? ""}
        onChange={(value) => set("section", value)}
        options={SECTIONS.map((s) => [s.key, s.label])}
        blank="Choose a section..."
        required
        className={selectClasses}
      />

      <ChoiceField
        id="weapon"
        label="Weapon"
        value={form.weapon ?? ""}
        onChange={(value) => set("weapon", value)}
        options={Object.entries(WEAPON_LABELS)}
        blank="Fits any weapon"
        className={selectClasses}
      />

      <ChoiceField
        id="kind"
        label="Type of item"
        value={form.kind ?? ""}
        onChange={(value) => set("kind", value)}
        options={Object.entries(KIND_LABELS)}
        blank="Not set"
        className={selectClasses}
      />

      <ChoiceField
        id="level"
        label="Practice, electric or FIE"
        value={form.level ?? ""}
        onChange={(value) => set("level", value)}
        options={Object.entries(LEVEL_LABELS)}
        blank="Does not apply"
        className={selectClasses}
      />

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="sizes">Sizes</Label>
        <Input
          id="sizes"
          value={form.sizes}
          onChange={function (e) {
            set("sizes", e.target.value);
          }}
          placeholder="S, M, L, XL"
        />
        <p className="text-xs text-muted-foreground">
          Comma separated. Leave empty for one-size items — those can be added
          straight from the catalogue without opening the product page.
        </p>
      </div>

      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id="is_active"
          type="checkbox"
          checked={form.is_active}
          onChange={function (e) {
            set("is_active", e.target.checked);
          }}
          className="h-4 w-4"
        />
        <Label htmlFor="is_active" className="font-normal">
          Show this product in the shop
        </Label>
      </div>

      {error ? (
        <p className="text-sm text-destructive sm:col-span-2">{error}</p>
      ) : null}

      <div className="flex gap-2 sm:col-span-2">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving..." : editing ? "Save changes" : "Add product"}
        </Button>
        <Button
          variant="outline"
          onClick={function () {
            router.push("/protected/admin/products");
          }}
          disabled={busy}
        >
          Cancel
        </Button>
        {editing ? (
          <Button
            variant="outline"
            onClick={remove}
            disabled={busy}
            className="ml-auto text-destructive"
          >
            Delete permanently
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// A labelled dropdown for one of the browse fields.
function ChoiceField({
  id,
  label,
  value,
  onChange,
  options,
  blank,
  required,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  blank: string;
  required?: boolean;
  className: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} value={value} required={required} onChange={(e) => onChange(e.target.value)} className={className}>
        <option value="">{blank}</option>
        {options.map(([key, text]) => (
          <option key={key} value={key}>{text}</option>
        ))}
      </select>
    </div>
  );
}
