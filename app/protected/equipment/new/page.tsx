import { redirect } from 'next/navigation'
import { createEquipmentItemAction } from '@/app/actions/equipment'
import { EquipmentForm } from '@/components/portal/equipment-form'
import { getEquipmentFormData } from '@/lib/services/EquipmentService'

export default async function NewEquipmentItemPage() {
  const result = await getEquipmentFormData()
  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    redirect('/protected')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Add equipment item</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick a type first — it decides the code and whether the item needs a size or handedness.
        </p>
      </div>

      <EquipmentForm
        types={result.types}
        existingCodes={result.items.map((item) => item.code)}
        members={result.members}
        action={createEquipmentItemAction}
        submitLabel="Add item"
      />
    </div>
  )
}
