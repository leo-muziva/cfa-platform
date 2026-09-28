// "use client" means this runs in the browser. Needed because it
// responds to clicks — server components can't do that.
"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleFavourite } from "../actions/favourites";

export function FavouriteButton({
  productId,
  initiallyFavourite,
}: {
  productId: number;
  // Whether this product was already a favourite when the page loaded.
  initiallyFavourite: boolean;
}) {
  // We keep our own copy of "is this a favourite" here in the browser.
  // That's what lets the heart fill the instant it's clicked, rather
  // than waiting for the server to reply.
  const [isFavourite, setIsFavourite] = useState(initiallyFavourite);

  // Stops double-clicks firing two saves at once.
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    // The product card behind this button is a link to the product page.
    // Without these two lines, favouriting something would also
    // navigate away from the catalogue.
    e.preventDefault();
    e.stopPropagation();

    setBusy(true);

    // Remember what it was, so we can undo if the save fails.
    const wasFavourite = isFavourite;

    // Flip the heart immediately. This is the bit that makes it feel fast.
    setIsFavourite(!wasFavourite);

    // Now actually save it.
    const result = await toggleFavourite(productId, wasFavourite);

    // Save failed, so put the heart back how it was.
    // Better than showing a filled heart for something that wasn't saved.
    if (result.error) {
      setIsFavourite(wasFavourite);
    }

    setBusy(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      // Screen readers announce this instead of the icon.
      aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
      // absolute + right-3 top-3 pins it to the top-right of the card's image.
      // z-20 keeps it above the image and the item code badge.
      className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm transition hover:scale-110"
    >
      <Heart
        className={
          // Filled red when saved, plain grey outline when not.
          "h-4 w-4 transition " +
          (isFavourite ? "fill-red-500 text-red-500" : "text-muted-foreground")
        }
      />
    </button>
  );
}