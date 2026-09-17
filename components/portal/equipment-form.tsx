'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CONDITION_LABELS, EQUIPMENT_CONDITIONS, EQUIPMENT_SIZES, EQUIPMENT_STATUSES,
  HAND_LABELS, STATUS_LABELS, nextItemCode,
} from '@/lib/equipment-register'
import type { EquipmentActionState } from '@/app/actions/equipment'
import type { EquipmentItem, EquipmentType } from '@/types/domain'

const selectClasses =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function EquipmentForm({
  types, existingCodes, item, action, submitLabel,
}: {
  types: EquipmentType[]
  /** Every code already on the register, so a new item can be offered the next
   *  free one for its type. Only a suggestion — the server checks on save. */
  existingCodes: string[]
  item?: EquipmentItem
  action: (state: EquipmentActionState, formData: FormData) => Promise<EquipmentActionState>
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [typeId, setTypeId] = useState(item?.type_id ?? '')
  const [code, setCode] = useState(item?.code ?? '')
  const [size, setSize] = useState<string>(item?.size ?? '')
  const [hand, setHand] = useState<string>(item?.hand ?? '')

  const selectedType = types.find((type) => type.id === typeId)

  // Changing the type changes which attributes apply, so the code suggestion
  // and the now-irrelevant fields are reset with it.
  function changeType(nextTypeId: string) {
    const nextType = types.find((type) => type.id === nextTypeId)
    setTypeId(nextTypeId)
    setCode(nextType ? nextItemCode(nextType.code_prefix, existingCodes) : '')
    setSize('')
    setHand('')
  }

  return (
    <form action={formAction} className="grid gap-6 max-w-xl">
      {item && <input type="hidden" name="item_id" value={item.id} />}

      <div className="grid gap-2">
        <Label htmlFor="type_id">Equipment type</Label>
        {item ? (
          <>
            <input type="hidden" name="type_id" value={typeId} />
            <p className="text-sm text-muted-foreground">
              {selectedType?.name ?? 'Unknown type'} — an item cannot change type, since its code belongs to that type.
            </p>
          </>
        ) : (
          <select id="type_id" name="type_id" required value={typeId} className={selectClasses}
            onChange={(event) => changeType(event.target.value)}>
            <option value="">Select a type…</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        )}
      </div>

      {selectedType && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="code">Item code</Label>
            <Input id="code" name="code" required value={code} className="font-mono"
              onChange={(event) => setCode(event.target.value.toUpperCase())} />
            <p className="text-xs text-muted-foreground">Suggested from the codes already in use — change it if you need to.</p>
          </div>

          {selectedType.requires_size && (
            <div className="grid gap-2">
              <Label htmlFor="size">Size</Label>
              <select id="size" name="size" required value={size} className={selectClasses}
                onChange={(event) => setSize(event.target.value)}>
                <option value="">Select a size…</option>
                {EQUIPMENT_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          )}

          {selectedType.requires_hand && (
            <div className="grid gap-2">
              <Label htmlFor="hand">Handedness</Label>
              <select id="hand" name="hand" required value={hand} className={selectClasses}
                onChange={(event) => setHand(event.target.value)}>
                <option value="">Select handedness…</option>
                <option value="right">{HAND_LABELS.right}</option>
                <option value="left">{HAND_LABELS.left}</option>
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="condition">Condition</Label>
              <select id="condition" name="condition" defaultValue={item?.condition ?? 'good'} className={selectClasses}>
                {EQUIPMENT_CONDITIONS.map((option) => (
                  <option key={option} value={option}>{CONDITION_LABELS[option]}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={item?.status ?? 'in_storage'} className={selectClasses}>
                {EQUIPMENT_STATUSES.map((option) => (
                  <option key={option} value={option}>{STATUS_LABELS[option]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={item?.notes ?? ''}
              placeholder="Anything worth recording about this item"
              className={`${selectClasses} h-auto min-h-16 resize-y`} />
          </div>
        </>
      )}

      <div aria-live="polite" aria-atomic="true" className="min-h-5">
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {state.success && <p role="status" className="text-sm text-green-600">{state.success}</p>}
      </div>

      <div>
        <Button type="submit" disabled={pending || !typeId}>{pending ? 'Working…' : submitLabel}</Button>
      </div>
    </form>
  )
}
