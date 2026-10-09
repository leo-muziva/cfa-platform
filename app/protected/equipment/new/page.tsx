import Link from 'next/link'
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
        <Link href="/protected/equipment"
          className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground hover:text-foreground">
          ← Equipment register
        </Link>
        <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">Add equipment item</h1>
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
