'use client'
import Image from 'next/image'
import Link from 'next/link'
import { completeProfileAction } from '@/app/actions/onboarding'
import { FieldError, useFormAction, ValidatedForm } from '@/components/forms/form-state'
import { BirthDatePicker } from '@/components/forms/date-picker'
import { PhoneInput } from '@/components/forms/phone-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CompleteProfilePage() {
  const [state, action, pending] = useFormAction(completeProfileAction, {})
  return (
    <Card className="max-w-4xl">
      <div className="grid md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex flex-col items-center gap-2 px-6 pt-6 text-center md:order-last md:justify-center md:border-l md:border-border md:px-8 md:py-10">
          <Image
            src="/media/brand/cfa-crest.png"
            alt="Cape Fencing Academy crest"
            width={160}
            height={160}
            priority
            className="h-20 w-20 rounded-full md:h-40 md:w-40"
          />
          <p className="font-serif text-lg font-light tracking-tight">Cape Fencing Academy</p>
          <p className="hidden text-sm text-muted-foreground md:block">
            A few details so coaches can reach you, or someone close to you, around lessons.
          </p>
        </div>
        <div>
          <CardHeader><CardTitle>Complete your profile</CardTitle></CardHeader>
          <CardContent>
            <ValidatedForm action={action} state={state} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" autoComplete="name" required minLength={2} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <PhoneInput id="phone" name="phone" required />
                </div>
                <div>
                  <Label htmlFor="date_of_birth">Date of birth</Label>
                  <BirthDatePicker id="date_of_birth" name="date_of_birth" required />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_name">Emergency contact</Label>
                  <Input id="emergency_contact_name" name="emergency_contact_name" required />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone">Emergency phone</Label>
                  <PhoneInput id="emergency_contact_phone" name="emergency_contact_phone" required />
                </div>
              </div>
              <div>
                <label className="flex gap-2 text-sm"><input type="checkbox" name="terms_accepted" />I accept the Terms and Conditions</label>
                <FieldError name="terms_accepted" />
              </div>
              <div>
                <label className="flex gap-2 text-sm"><input type="checkbox" name="privacy_accepted" />I consent to the privacy notice</label>
                <FieldError name="privacy_accepted" />
              </div>
              <div>
                <label className="flex gap-2 text-sm"><input type="checkbox" name="payer_consent" />I am the payer/guardian and consent for this minor</label>
                <FieldError name="payer_consent" />
              </div>
              {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
              {state.success && <p role="status" className="text-sm text-green-600 dark:text-green-400">{state.success}. You can now <Link className="underline" href="/protected/book">book a lesson</Link> or <Link className="underline" href="/protected">go to your dashboard</Link>.</p>}
              <Button disabled={pending}>{pending ? 'Saving…' : 'Complete profile'}</Button>
            </ValidatedForm>
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
