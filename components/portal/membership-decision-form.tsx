'use client'

import { useFormAction, ValidatedForm } from '@/components/forms/form-state'
import { decideMembershipRequestAction } from '@/app/actions/platform'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function MembershipDecisionForm({ applicationId, privateNotes }: {
  applicationId: string
  privateNotes: string | null
}) {
  const [state, formAction, pending] = useFormAction(decideMembershipRequestAction, {})

  return (
    <ValidatedForm action={formAction} state={state} className="space-y-4">
      <input type="hidden" name="application_id" value={applicationId} />
      <div>
        <Label htmlFor={`response-${applicationId}`}>Response visible to applicant</Label>
        <textarea id={`response-${applicationId}`} name="visible_response" className="min-h-20 w-full rounded-md border bg-background p-3" />
      </div>
      <div>
        <Label htmlFor={`notes-${applicationId}`}>Private admin notes</Label>
        <textarea id={`notes-${applicationId}`} name="private_notes" defaultValue={privateNotes ?? ''} className="min-h-20 w-full rounded-md border bg-background p-3" />
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-green-600 dark:text-green-400">{state.success}</p>}
      <div className="flex flex-wrap gap-2">
        <Button name="decision" value="approve" disabled={pending}>Approve and request payment</Button>
        <Button name="decision" value="request_changes" variant="outline" disabled={pending}>Request changes</Button>
        <Button name="decision" value="reject" variant="outline" disabled={pending}>Reject</Button>
      </div>
    </ValidatedForm>
  )
}
