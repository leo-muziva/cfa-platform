'use client'

import { useFormAction, ValidatedForm } from '@/components/forms/form-state'
import { inviteMemberAction } from '@/app/actions/admin-members'
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

/** Admin form that sends a Supabase invite, optionally with staff access. */
export function InviteMemberForm() {
  const [state, formAction, isPending] = useFormAction(inviteMemberAction, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
        <CardDescription>
          They receive an email invitation. Their profile and selected staff
          access become available after they confirm and set a password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ValidatedForm action={formAction} state={state} className="flex flex-col gap-4">
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

          <div className="grid gap-4 sm:grid-cols-2"><div className="flex items-center gap-2"><input id="is_staff" name="is_staff" type="checkbox" className="h-4 w-4 rounded border-input accent-primary"/><Label htmlFor="is_staff">Staff account</Label></div><div className="grid gap-2"><Label htmlFor="staff_type">Staff type</Label><select id="staff_type" name="staff_type" defaultValue="" className={selectClasses}><option value="">None</option><option value="coach">Coach</option><option value="admin">Admin</option></select></div></div>

          {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600 dark:text-green-400" role="status">{state.message}</p>}

          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? 'Sending invite...' : 'Send invite'}
          </Button>
        </ValidatedForm>
      </CardContent>
    </Card>
  )
}
