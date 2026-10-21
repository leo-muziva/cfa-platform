'use client'

import { Button } from '@/components/ui/button'
import { useFormAction, ValidatedForm } from '@/components/forms/form-state'
import type { ActionState } from '@/app/actions/platform'

export function ActionForm({ action, children, submitLabel, className = 'space-y-4', submitClassName }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  submitLabel: string
  className?: string
  submitClassName?: string
}) {
  const [state, formAction, pending] = useFormAction(action, {})
  return (
    <ValidatedForm action={formAction} state={state} className={className}>
      {children}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-green-600 dark:text-green-400">{state.success}</p>}
      <Button type="submit" disabled={pending} className={submitClassName}>{pending ? 'Working…' : submitLabel}</Button>
    </ValidatedForm>
  )
}
