"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Remembers the last 25 pages visited on this site, in session storage, so
// BackButton never sends someone back to another website.
const HISTORY_KEY = "cfa.internal-navigation";
const MAX_HISTORY_LENGTH = 25;

// The stored history, or an empty list when storage is unavailable or corrupt.
function readHistory(): string[] {
  try {
    const value = window.sessionStorage.getItem(HISTORY_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
/** The page visited before `currentPath`, or null when there is none. */
export function getPreviousInternalPath(currentPath: string): string | null {
  const history = readHistory();
  const currentIndex = history.lastIndexOf(currentPath);
  const previousIndex = currentIndex === -1 ? history.length - 1 : currentIndex - 1;
  const previous = history[previousIndex];
  return previous?.startsWith("/") && !previous.startsWith("//") ? previous : null;
}

/**
 * Records each page visit. Mounted once in the root layout. Going back to
 * the previous page pops it instead of adding it again.
 */
export function NavigationHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const history = readHistory();

    if (history.at(-1) === currentPath) return;

    if (history.at(-2) === currentPath) {
      history.pop();
    } else {
      history.push(currentPath);
    }

    window.sessionStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(-MAX_HISTORY_LENGTH)),
    );
  }, [pathname]);

  return null;
}
