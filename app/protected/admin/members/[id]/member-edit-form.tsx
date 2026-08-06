'use client'

import { useActionState } from 'react'
import { adminUpdateMemberAction } from '@/app/actions/admin-members'
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

const selectClasses =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function MemberEditForm({
  profile,
}: {
  profile: Profile
}) {
  const [state, formAction, isPending] = useActionState(adminUpdateMemberAction, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Details</CardTitle>
        <CardDescription>
          Changes apply immediately. Email cannot be changed here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="member_id" value={profile.id} />

          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile.full_name ?? ''}
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 py-1"><input id="is_staff" name="is_staff" type="checkbox" defaultChecked={profile.is_staff} className="h-4 w-4 rounded border-input accent-primary"/><Label htmlFor="is_staff">Staff account</Label></div>
            <div className="grid gap-2"><Label htmlFor="staff_type">Staff type</Label><select id="staff_type" name="staff_type" defaultValue={profile.staff_type ?? ''} className={selectClasses}><option value="">None</option><option value="coach">Coach</option><option value="admin">Admin</option></select></div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={profile.is_active}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="is_active">Active member</Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Deactivated members keep their history but are excluded from invoicing.
          </p>

          {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600" role="status">{state.message}</p>}

          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
