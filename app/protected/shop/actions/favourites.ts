// "use server" means everything in this file runs on the server only,
// never in the browser. That's what lets it talk to the database safely.
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// One function handles both adding and removing a favourite.
// The button tells us what the product currently is, and we do the opposite.
// currentlyFavourite = true  -> remove it
// currentlyFavourite = false -> add it
export async function toggleFavourite(
  productId: number,
  currentlyFavourite: boolean
) {
  const supabase = await createClient();

  // Work out who is logged in. Favourites belong to a person,
  // so there's nothing we can do without this.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: "You need to be logged in." };
  }

  if (currentlyFavourite) {
    // REMOVE: delete the row matching this person and this product.
    // Both conditions matter — without the user_id check we'd be
    // trying to delete everyone's favourite of that product.
    const { error } = await supabase
      .from("favourites")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("product_id", productId);

    if (error) {
      return { error: "Could not remove that favourite." };
    }
  } else {
    // ADD: create a new row linking this person to this product.
    // The database blocks duplicates, so clicking twice can't
    // create two rows for the same product.
    const { error } = await supabase
      .from("favourites")
      .insert({ user_id: auth.user.id, product_id: productId });

    if (error) {
      return { error: "Could not save that favourite." };
    }
  }

  // Tell Next the shop page has changed, so it rebuilds it
  // with the new favourite state instead of showing a cached copy.
  revalidatePath("/protected/shop");

  return { success: true };
}