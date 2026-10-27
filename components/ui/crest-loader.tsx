import Image from "next/image";

// Page loader shown by app/protected/loading.tsx while a portal page loads.
// Inline, not a fixed overlay, because the portal glass panel would squash
// a fixed overlay to its own height.
export function CrestLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[60vh] w-full items-center justify-center"
    >
      <span className="sr-only">Loading page</span>
      <Image
        src="/media/brand/cfa-crest.png"
        alt=""
        width={499}
        height={500}
        // no priority: it preloaded the crest on every page change, even when
        // the loader never showed, which filled the console with warnings
        className="cfa-crest-pulse h-auto w-28 sm:w-32"
      />
    </div>
  );
}
