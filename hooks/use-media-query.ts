"use client";

import { useCallback, useSyncExternalStore } from "react";

// True while the media query matches. The server and the first client render
// both report false, so layout that depends on it never causes a hydration
// mismatch.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
