import { redirect } from 'next/navigation'
import { requireCoachOrAdmin } from '@/lib/services/MemberService'

export default async function EquipmentLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireCoachOrAdmin()
  if ('error' in guard) redirect(guard.error === 'Not authenticated' ? '/auth/login' : '/protected')
  return <div className="flex-1 w-full flex flex-col gap-6">{children}</div>
}
