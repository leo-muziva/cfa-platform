'use client'

import { useActionState } from 'react'
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

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, {})

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
          <form action={formAction} className="flex flex-col gap-4">
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
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ''}
                placeholder="+27 00 000 0000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                defaultValue={profile.date_of_birth ?? ''}
              />
            </div>

            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            {state.success && (
              <p className="text-sm text-green-600">{state.message}</p>
            )}

            <Button type="submit" disabled={isPending} className="w-fit">
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
