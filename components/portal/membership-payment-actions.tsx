'use client'

import { useFormAction, ValidatedForm } from '@/components/forms/form-state'
import {
  recordManualMembershipPaymentAction,
  resendMembershipPaymentEmailAction,
  withdrawMembershipApprovalAction,
} from '@/app/actions/platform'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Action = typeof resendMembershipPaymentEmailAction

// The error or success message from a membership action.
function ActionResult({ state }: { state: { error?: string; success?: string } }) {
  return (
    <>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-green-600 dark:text-green-400">{state.success}</p>}
    </>
  )
}

// A form that posts just the application id when its one button is pressed.
function SingleButtonForm({ action, applicationId, label, variant }: {
  action: Action
  applicationId: string
  label: string
  variant?: 'outline'
}) {
  const [state, formAction, pending] = useFormAction(action, {})
  return (
    <ValidatedForm action={formAction} state={state} className="space-y-2">
      <input type="hidden" name="application_id" value={applicationId} />
      <Button variant={variant} disabled={pending}>{label}</Button>
      <ActionResult state={state} />
    </ValidatedForm>
  )
}

// Shown for an approved application whose payment has not arrived yet.
export function MembershipPaymentActions({ applicationId }: { applicationId: string }) {
  const [paymentState, paymentAction, recording] = useFormAction(recordManualMembershipPaymentAction, {})
  const [withdrawState, withdrawAction, withdrawing] = useFormAction(withdrawMembershipApprovalAction, {})
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <ValidatedForm action={paymentAction} state={paymentState} className="space-y-2">
          <input type="hidden" name="application_id" value={applicationId} />
          <Button disabled={recording}>Record EFT or cash payment</Button>
          <ActionResult state={paymentState} />
        </ValidatedForm>
        <SingleButtonForm action={resendMembershipPaymentEmailAction} applicationId={applicationId} label="Resend payment email" variant="outline" />
      </div>
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">Withdraw approval</summary>
        <ValidatedForm action={withdrawAction} state={withdrawState} className="mt-3 space-y-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <div>
            <Label htmlFor={`withdraw-response-${applicationId}`}>Response visible to applicant</Label>
            <textarea id={`withdraw-response-${applicationId}`} name="visible_response" className="min-h-20 w-full rounded-md border bg-background p-3" />
          </div>
          <p className="text-sm text-muted-foreground">
            The charges are cancelled and the applicant can apply again. A payment that still arrives is kept as account credit.
          </p>
          <Button variant="outline" disabled={withdrawing}>Withdraw approval</Button>
          <ActionResult state={withdrawState} />
        </ValidatedForm>
      </details>
    </div>
  )
}
