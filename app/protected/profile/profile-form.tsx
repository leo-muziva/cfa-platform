'use client'

import { useFormAction, ValidatedForm } from '@/components/forms/form-state'
import { PhoneInput } from '@/components/forms/phone-input'
import { BirthDatePicker } from '@/components/forms/date-picker'
import { updateProfileAction } from '@/app/actions/profile'
import type { Profile } from '@/types/domain'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function ProfileForm({ profile, whatsAppAvailable = false }: { profile: Profile; whatsAppAvailable?: boolean }) {
  const [state, formAction, isPending] = useFormAction(updateProfileAction, {})
  const savedPreference = profile.reminder_preference ?? 'email'
  // a WhatsApp choice saved earlier is kept, but reminders go by email for now
  const whatsAppPaused = !whatsAppAvailable && savedPreference !== 'email'

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      <Card className="cfa-light-card">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Managed by CFA staff</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-1">
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <div className="grid gap-1">
            <Label>Account status</Label>
            <div>
              <Badge variant="secondary">{profile.staff_type ?? profile.membership_status}</Badge>
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Membership Type</Label>
            <p className="text-sm text-muted-foreground">
              {profile.membership_type?.name ?? 'Not assigned'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="cfa-light-card">
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <ValidatedForm action={formAction} state={state} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name ?? ''}
                required
                minLength={2}
                maxLength={100}
                placeholder="Your full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <PhoneInput id="phone" name="phone" defaultValue={profile.phone} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <BirthDatePicker id="date_of_birth" name="date_of_birth" defaultValue={profile.date_of_birth} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder_preference">Lesson reminders</Label>
              {/* While WhatsApp is off the choice is fixed to email and isn't
                  sent (a disabled select isn't submitted), so nothing saved changes. */}
              <select
                id="reminder_preference"
                name="reminder_preference"
                defaultValue={whatsAppAvailable ? savedPreference : 'email'}
                disabled={!whatsAppAvailable}
                aria-describedby={whatsAppAvailable ? undefined : "reminder-preference-hint"}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
              >
                <option value="email">Email</option>
                <option value="whatsapp" disabled={!whatsAppAvailable}>WhatsApp</option>
                <option value="both" disabled={!whatsAppAvailable}>Email and WhatsApp</option>
              </select>
              {!whatsAppAvailable && (
                <p id="reminder-preference-hint" className="text-xs text-muted-foreground">
                  WhatsApp reminders remain unavailable until CFA enables an approved provider.
                  {whatsAppPaused ? ' You chose WhatsApp before, so for now your reminders are sent by email.' : ''}
                </p>
              )}
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">{state.error}</p>
            )}
            {state.success && (
              <p className="text-sm text-green-600 dark:text-green-400">{state.message}</p>
            )}

            <Button type="submit" disabled={isPending} className="w-fit">
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </ValidatedForm>
        </CardContent>
      </Card>
    </div>
  )
}
