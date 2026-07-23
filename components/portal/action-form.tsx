'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import type { ActionState } from '@/app/actions/platform'

export function ActionForm({ action, children, submitLabel }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-green-600">{state.success}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Working…' : submitLabel}</Button>
    </form>
  )
}
