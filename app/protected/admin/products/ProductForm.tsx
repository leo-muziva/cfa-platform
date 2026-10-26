"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KIND_LABELS, LEVEL_LABELS, SECTIONS, WEAPON_LABELS } from "@/lib/shop/browse";
import { productImageUrl } from "@/lib/productImage";
import { PRODUCT_PHOTO_MAX_BYTES } from "@/lib/validations/product.schema";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  setProductPhoto,
  type ProductInput,
} from "./actions";

const PHOTO_TYPES = "image/jpeg,image/png,image/webp";

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
  image_path?: string | null;
};

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

  // The photo is only uploaded when the form is saved.
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const currentPhotoUrl = productImageUrl(product?.image_path ?? null);
  const shownPhoto = photoPreview ?? currentPhotoUrl;

  // Free the preview's memory when it changes or the form closes.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Updates one field without disturbing the rest.
  function set(field: keyof ProductInput, value: string | boolean) {
    setForm(function (f) {
      return { ...f, [field]: value };
    });
  }

  function choosePhoto(file: File | null) {
    setError("");
    if (file && file.size > PRODUCT_PHOTO_MAX_BYTES) {
      setError("Photos must be 4 MB or smaller.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function save() {
    setBusy(true);
    setError("");

    const result = editing
      ? await updateProduct(product!.id, form)
      : await createProduct(form);

    if (result.error) {
      setBusy(false);
      setError(result.error);
      return;
    }

    let productId: number | undefined = product?.id;
    if (!product && "id" in result && typeof result.id === "number") productId = result.id;
    if (photo && productId) {
      const upload = new FormData();
      upload.append("photo", photo);
      const photoResult = await setProductPhoto(productId, upload);
      if (photoResult.error) {
        setBusy(false);
        if (editing) {
          setError("Details saved, but the photo didn't upload: " + photoResult.error);
          return;
        }
        // The product exists now, so saving this form again would duplicate it.
        router.push("/protected/admin/products/" + productId + "?photo=failed");
        return;
      }
    }

    setBusy(false);
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

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="photo">Photo</Label>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input bg-white">
            {shownPhoto ? (
              <Image
                src={shownPhoto}
                alt={photoPreview ? "New photo, not saved yet" : "Current photo of " + (product?.name ?? "this product")}
                fill
                unoptimized
                sizes="128px"
                className="object-contain p-2"
              />
            ) : (
              <span className="px-2 text-center text-xs text-muted-foreground">No photo yet</span>
            )}
          </div>
          <div className="grid min-w-0 gap-2">
            <input
              id="photo"
              type="file"
              accept={PHOTO_TYPES}
              disabled={busy}
              onChange={function (e) {
                choosePhoto(e.target.files?.[0] ?? null);
              }}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted-foreground">
              JPG, PNG or WebP, up to 4 MB. {editing ? "Choosing a new photo replaces the current one when you save." : "Shown on the shop card and product page."}
            </p>
            {photo ? (
              <button
                type="button"
                onClick={function () {
                  choosePhoto(null);
                  const input = document.getElementById("photo") as HTMLInputElement | null;
                  if (input) input.value = "";
                }}
                disabled={busy}
                className="w-fit text-xs underline underline-offset-4"
              >
                {editing ? "Keep the current photo" : "Remove this photo"}
              </button>
            ) : null}
          </div>
        </div>
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
