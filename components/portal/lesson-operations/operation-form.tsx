"use client";

import { useActionState } from "react";
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
}: {
  action: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  className?: string;
  submitClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

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
