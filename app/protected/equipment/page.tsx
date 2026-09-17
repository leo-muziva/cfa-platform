import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEquipmentRegister } from '@/lib/services/EquipmentService'
import {
  CONDITION_LABELS, EQUIPMENT_CONDITIONS, EQUIPMENT_STATUSES, STATUS_LABELS,
  groupItemsByCategory, itemDetail, summariseRegister,
} from '@/lib/equipment-register'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EquipmentCondition, EquipmentItem, EquipmentStatus } from '@/types/domain'

const selectClasses =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

const STATUS_VARIANT: Record<EquipmentStatus, 'secondary' | 'outline' | 'destructive'> = {
  in_storage: 'secondary', with_member: 'outline', awaiting_repair: 'destructive',
}
const CONDITION_VARIANT: Record<EquipmentCondition, 'secondary' | 'outline' | 'destructive'> = {
  good: 'secondary', fair: 'outline', poor: 'destructive', broken: 'destructive',
}

function StatusCell({ item }: { item: EquipmentItem }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABELS[item.status]}</Badge>
      {item.status === 'with_member' && !item.assigned_to && (
        <span className="text-xs text-muted-foreground">not recorded</span>
      )}
    </span>
  )
}

export default async function EquipmentRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  // URL params can repeat (?status=a&status=b) — keep the first value of each.
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  )

  const result = await getEquipmentRegister(normalized)
  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    redirect('/protected')
  }

  const { items, filters, total } = result
  const hasFilters = Boolean(filters.search || filters.status || filters.condition)
  const summary = summariseRegister(items)
  const categories = groupItemsByCategory(items)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Equipment register</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hasFilters ? `${summary.total} of ${total} items match` : `${total} items on the club's books`}
          </p>
        </div>
        <Button asChild>
          <Link href="/protected/equipment/new">Add item</Link>
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Showing</dt>
          <dd className="text-xl font-semibold tabular-nums">{summary.total}</dd>
        </div>
        {EQUIPMENT_STATUSES.map((status) => (
          <div key={status} className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</dt>
            <dd className="text-xl font-semibold tabular-nums">{summary[status]}</dd>
          </div>
        ))}
      </dl>

      <form method="GET" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div className="grid gap-2">
          <Label htmlFor="search">Search</Label>
          <Input id="search" name="search" type="search" placeholder="Code, type or notes"
            defaultValue={filters.search ?? ''} maxLength={100} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={filters.status ?? ''} className={selectClasses}>
            <option value="">All statuses</option>
            {EQUIPMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="condition">Condition</Label>
          <select id="condition" name="condition" defaultValue={filters.condition ?? ''} className={selectClasses}>
            <option value="">All conditions</option>
            {EQUIPMENT_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>{CONDITION_LABELS[condition]}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {hasFilters && (
            <Button variant="outline" asChild>
              <Link href="/protected/equipment">Clear</Link>
            </Button>
          )}
        </div>
      </form>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              {hasFilters
                ? 'No equipment matches the current filters.'
                : 'Nothing on the register yet. Add the first item above.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => (
          <section key={category.category} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {category.label}
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            {category.types.map((group) => (
              <details
                key={group.type.id}
                open={hasFilters || undefined}
                className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-6 py-3 text-sm">
                  <span className="font-semibold">{group.type.name}</span>
                  <span className="text-muted-foreground">({group.items.length})</span>
                  <span className="flex flex-wrap gap-2">
                    {EQUIPMENT_STATUSES.filter((status) => group.counts[status] > 0).map((status) => (
                      <Badge key={status} variant={STATUS_VARIANT[status]}>
                        {group.counts[status]} {STATUS_LABELS[status].toLowerCase()}
                      </Badge>
                    ))}
                  </span>
                </summary>

                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-6 font-medium text-muted-foreground">Code</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Details</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Condition</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-6 font-medium font-mono">
                            <Link href={`/protected/equipment/${item.id}`} className="hover:underline underline-offset-4">
                              {item.code}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{itemDetail(item) || '—'}</td>
                          <td className="py-3 px-4">
                            <Badge variant={CONDITION_VARIANT[item.condition]}>{CONDITION_LABELS[item.condition]}</Badge>
                          </td>
                          <td className="py-3 px-4"><StatusCell item={item} /></td>
                          <td className="py-3 px-4 text-muted-foreground">{item.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
