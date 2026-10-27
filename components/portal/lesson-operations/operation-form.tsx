"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useFormAction, ValidatedForm } from "@/components/forms/form-state";
import type { FormFieldState } from "@/types/domain";

// Form state returned by the lesson operation Server Actions.
export interface LessonOperationState extends FormFieldState {
  success?: string;
}

/** A form for one lesson operation, showing the action's result. Used across the lesson admin screens. */
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
  const [state, formAction, pending] = useFormAction(action, {});
  const lastSuccessRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state.success && state.success !== lastSuccessRef.current) {
      lastSuccessRef.current = state.success;
      onSuccess?.();
    }
  }, [state.success, onSuccess]);

  return (
    <ValidatedForm action={formAction} state={state} className={className}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="min-h-5">
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        {state.success ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{state.success}</p> : null}
      </div>
      <Button type="submit" disabled={pending} variant={variant} className={submitClassName}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </ValidatedForm>
  );
}
