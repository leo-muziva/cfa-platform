"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 3000;
const MAX_CHECKS = 20;

// PayFast sends people back before its server-to-server confirmation lands,
// so the first view is usually "pending". Re-render the server page every few
// seconds for about a minute instead of asking the payer to refresh.
export function PaymentStatusRefresher() {
  const router = useRouter();
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    if (checks >= MAX_CHECKS) return;
    const timer = setTimeout(() => {
      router.refresh();
      setChecks((count) => count + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [checks, router]);

  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {checks < MAX_CHECKS
        ? "Checking with PayFast... this page updates by itself."
        : "Still waiting for PayFast. Refresh in a minute, or check your billing page."}
    </p>
  );
}
