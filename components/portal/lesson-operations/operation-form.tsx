"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export interface LessonOperationState {
  error?: string;
  success?: string;
}

export function OperationForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Working...",
  variant = "default",
  className = "space-y-4",
  submitClassName,
  onSuccess,
}: {
  action: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  className?: string;
  submitClassName?: string;
  /** Fires once when the action reports success — lets a caller (e.g. a
   * preview popup) auto-dismiss instead of leaving the success message
   * sitting behind a closed dialog. */
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const lastSuccessRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.success && state.success !== lastSuccessRef.current) {
      lastSuccessRef.current = state.success;
      onSuccess?.();
    }
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className={className}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="min-h-5">
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        {state.success ? <p role="status" className="text-sm text-emerald-700">{state.success}</p> : null}
      </div>
      <Button type="submit" disabled={pending} variant={variant} className={submitClassName}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
