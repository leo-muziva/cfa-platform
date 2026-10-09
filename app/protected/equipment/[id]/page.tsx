import Link from 'next/link'
import { redirect } from 'next/navigation'
import { deleteEquipmentItemAction, updateEquipmentItemAction } from '@/app/actions/equipment'
import { EquipmentDeleteButton } from '@/components/portal/equipment-delete-button'
import { EquipmentForm } from '@/components/portal/equipment-form'
import { getEquipmentFormData } from '@/lib/services/EquipmentService'

export default async function EditEquipmentItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getEquipmentFormData(id)
  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    if (result.error === 'Forbidden') redirect('/protected')
    redirect('/protected/equipment')
  }

  const { item, types, items, canDelete, members } = result
  if (!item) redirect('/protected/equipment')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/protected/equipment"
          className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground hover:text-foreground">
          ← Equipment register
        </Link>
        <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">{item.code}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {item.equipment_type?.name ?? 'Equipment item'}
        </p>
      </div>

      <EquipmentForm
        types={types}
        existingCodes={items.map((existing) => existing.code)}
        members={members}
        item={item}
        action={updateEquipmentItemAction}
        submitLabel="Save changes"
      />

      {canDelete && (
        <div className="border-t pt-6">
          <EquipmentDeleteButton itemId={item.id} code={item.code} action={deleteEquipmentItemAction} />
        </div>
      )}
    </div>
  )
}
