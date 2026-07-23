import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentAccountContext } from '@/lib/services/MemberService'

export default async function DependentsPage() {
  const context = await getCurrentAccountContext()
  if ('error' in context) redirect('/auth/login')
  if (!context.capabilities.isPayer) notFound()
  const dependents = context.householdMembers.filter((m) => m.household_role === 'dependent')
  if (!dependents.length) notFound()
  return <div className="space-y-6"><h1 className="text-3xl font-bold">My dependents</h1>{dependents.map((member) => <Card key={member.profile_id}><CardHeader><CardTitle>{member.profile?.full_name || member.profile?.email}</CardTitle></CardHeader><CardContent><Button asChild><Link href="/protected/book">Book on their behalf</Link></Button></CardContent></Card>)}</div>
}
