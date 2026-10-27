"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { getPreviousInternalPath } from "@/components/navigation-history";
import { cn } from "@/lib/utils";

// Where to go back to from pages under `prefix` when there is no history.
interface RouteFallback {
  prefix: string;
  target: string;
}

/**
 * A "Back" button that returns to the previous page inside this site. When
 * the visitor arrived from elsewhere (or history is off), it goes to the
 * fallback for the current route instead of leaving the site.
 */
export function BackButton({
  fallback,
  rootFallback = "/",
  routeFallbacks = [],
  useHistory = true,
  className,
  label = "Back",
}: {
  fallback: string;
  rootFallback?: string;
  routeFallbacks?: RouteFallback[];
  useHistory?: boolean;
  className?: string;
  label?: string;
}) {
  const router = useRouter();

  const goBack = () => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const previousPath = useHistory
      ? getPreviousInternalPath(currentPath)
      : null;

    if (previousPath && previousPath !== currentPath) {
      router.push(previousPath);
      return;
    }

    const contextualFallback =
      routeFallbacks.find(({ prefix }) => window.location.pathname.startsWith(prefix))
        ?.target ?? fallback;
    router.push(
      window.location.pathname === contextualFallback
        ? rootFallback
        : contextualFallback,
    );
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
