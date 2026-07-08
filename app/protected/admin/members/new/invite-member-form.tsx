'use client'

import { useActionState } from 'react'
import { inviteMemberAction } from '@/app/actions/admin-members'
import type { MembershipType, Role } from '@/types/domain'
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

const ROLES: { value: Role; label: string }[] = [
  { value: 'fencer', label: 'Fencer' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'coach', label: 'Coach' },
  { value: 'admin', label: 'Admin' },
]

const selectClasses =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function InviteMemberForm({ membershipTypes }: { membershipTypes: MembershipType[] }) {
  const [state, formAction, isPending] = useActionState(inviteMemberAction, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
        <CardDescription>
          They receive an email invitation, set their own password, and their
          profile is created automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              required
              placeholder="member@example.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Jane Fencer"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" defaultValue="fencer" className={selectClasses}>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="membership_type_id">Membership Type</Label>
              <select
                id="membership_type_id"
                name="membership_type_id"
                defaultValue=""
                className={selectClasses}
              >
                <option value="">No membership</option>
                {membershipTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} — R{type.monthly_fee}/month
                  </option>
                ))}
              </select>
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600" role="status">{state.message}</p>}

          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? 'Sending invite...' : 'Send invite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
