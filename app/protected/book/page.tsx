import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ActionForm } from '@/components/portal/action-form'
import { bookLessonAction } from '@/app/actions/platform'
import { getBookingPageData } from '@/lib/services/PlatformService'

export default async function BookLessonPage() {
  const data = await getBookingPageData()
  if ('error' in data) redirect('/auth/login')
  const allowedFencers = data.capabilities.isAdmin || data.capabilities.isPayer
    ? data.householdMembers : data.householdMembers.filter((m) => m.profile_id === data.profile.id)
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Book a lesson</h1><p className="text-muted-foreground">Only staff-opened future slots are shown.</p></div>
    {data.slots.length === 0 ? <p>No lesson slots are currently open.</p> : data.slots.map((slot) => <Card key={slot.id}><CardHeader><CardTitle>{new Date(slot.starts_at).toLocaleString('en-ZA')}</CardTitle></CardHeader><CardContent>
      <ActionForm action={bookLessonAction} submitLabel="Confirm booking">
        <input type="hidden" name="lesson_slot_id" value={slot.id} />
        <div className="space-y-2"><Label htmlFor={`fencer-${slot.id}`}>Who is this lesson for?</Label><select id={`fencer-${slot.id}`} name="fencer_id" defaultValue={data.profile.id} className="w-full rounded-md border bg-background px-3 py-2">
          {allowedFencers.map((member) => <option key={member.profile_id} value={member.profile_id}>{member.profile?.full_name || member.profile?.email || 'Account member'}</option>)}
        </select></div>
        {data.capabilities.isDependent ? <><input type="hidden" name="payment_option" value="pay_later" /><p className="text-sm text-muted-foreground">Payment will be handled by your payer.</p></> : <div className="space-y-2"><Label htmlFor={`payment-${slot.id}`}>Payment</Label><select id={`payment-${slot.id}`} name="payment_option" className="w-full rounded-md border bg-background px-3 py-2"><option value="pay_now">Pay now - R{Number(slot.price).toFixed(2)}</option>{data.profile.membership_status === 'member' && <option value="pay_later">Pay later</option>}</select>{!data.capabilities.isDependent && <p className="text-sm text-muted-foreground">Payment provider is not configured. Pay-now bookings are recorded as awaiting payment.</p>}</div>}
      </ActionForm>
    </CardContent></Card>)}</div>
}
