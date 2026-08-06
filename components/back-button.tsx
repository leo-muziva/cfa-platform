"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { getPreviousInternalPath } from "@/components/navigation-history";
import { cn } from "@/lib/utils";

interface RouteFallback {
  prefix: string;
  target: string;
}

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
