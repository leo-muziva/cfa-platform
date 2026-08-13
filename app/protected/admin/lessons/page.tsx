import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ActionForm } from '@/components/portal/action-form'
import { createSlotAction } from '@/app/actions/platform'
import { listOpenSlots } from '@/lib/repositories/PlatformRepository'
import { formatCapeTownLessonDate } from '@/lib/booking-calendar'

export default async function LessonSlotsAdminPage() {
  const slots = await listOpenSlots()
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Lesson slot management</h1><Card><CardHeader><CardTitle>Open a lesson slot</CardTitle></CardHeader><CardContent><ActionForm action={createSlotAction} submitLabel="Open slot">
    <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="starts_at">Starts</Label><Input id="starts_at" name="starts_at" type="datetime-local" required /></div><div><Label htmlFor="ends_at">Ends</Label><Input id="ends_at" name="ends_at" type="datetime-local" required /></div><div><Label htmlFor="price">List price</Label><Input id="price" name="price" type="number" min="0" step="0.01" required /></div><div><Label htmlFor="capacity">Capacity (optional)</Label><Input id="capacity" name="capacity" type="number" min="1" /></div><div><Label htmlFor="access_rule">Who may book?</Label><select id="access_rule" name="access_rule" className="w-full rounded-md border bg-background px-3 py-2"><option value="guest_allowed">Guests and members</option><option value="active_members_only">Active members only</option></select></div></div>
  </ActionForm></CardContent></Card><section className="space-y-3"><h2 className="text-xl font-semibold">Open slots</h2>{slots.map((slot) => <Card key={slot.id}><CardContent className="pt-6">{formatCapeTownLessonDate(slot.starts_at)} - R{Number(slot.price).toFixed(2)}</CardContent></Card>)}</section></div>
}
