import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/services/MemberService'
import { AdminNavigation } from '@/components/portal/admin-navigation'

/** Layout for /protected/admin/*. Only admins get in; everyone else is sent back to the portal. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireAdmin()
  if ('error' in guard) redirect(guard.error === 'Not authenticated' ? '/auth/login' : '/protected')
  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <AdminNavigation />
      {children}
    </div>
  )
}
