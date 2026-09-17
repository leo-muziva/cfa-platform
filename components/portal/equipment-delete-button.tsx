'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EquipmentActionState } from '@/app/actions/equipment'

export function EquipmentDeleteButton({
  itemId, code, action,
}: {
  itemId: string
  code: string
  action: (state: EquipmentActionState, formData: FormData) => Promise<EquipmentActionState>
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Delete item
      </Button>
    )
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-destructive/40 p-4">
      <input type="hidden" name="item_id" value={itemId} />
      <p className="text-sm">
        Remove <span className="font-mono font-medium">{code}</span> from the register? This cannot be undone.
      </p>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'Deleting…' : 'Yes, delete it'}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
