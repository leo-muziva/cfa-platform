'use client'
import { useActionState } from 'react'
import { completeProfileAction } from '@/app/actions/onboarding'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CompleteProfilePage() {
  const [state, action, pending] = useActionState(completeProfileAction, {})
  return <Card className="max-w-2xl"><CardHeader><CardTitle>Complete your profile</CardTitle></CardHeader><CardContent><form action={action} className="space-y-4"><div><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required minLength={2}/></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" type="tel" required/></div><div><Label htmlFor="date_of_birth">Date of birth</Label><Input id="date_of_birth" name="date_of_birth" type="date" required/></div><div><Label htmlFor="emergency_contact_name">Emergency contact</Label><Input id="emergency_contact_name" name="emergency_contact_name" required/></div><div><Label htmlFor="emergency_contact_phone">Emergency phone</Label><Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" required/></div></div><label className="flex gap-2 text-sm"><input type="checkbox" name="terms_accepted" required/>I accept the Terms and Conditions</label><label className="flex gap-2 text-sm"><input type="checkbox" name="privacy_accepted" required/>I consent to the privacy notice</label><label className="flex gap-2 text-sm"><input type="checkbox" name="payer_consent"/>I am the payer/guardian and consent for this minor</label>{state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.success && <p className="text-sm text-green-600">{state.success}</p>}<Button disabled={pending}>{pending ? 'Saving…' : 'Complete profile'}</Button></form></CardContent></Card>
}
