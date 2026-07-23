import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/services/MemberService'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireAdmin()
  if ('error' in guard) redirect(guard.error === 'Not authenticated' ? '/auth/login' : '/protected')
  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <nav aria-label="Admin sections" className="flex flex-wrap items-center gap-4 border-b pb-3 text-sm">
        <span className="font-semibold">Admin</span>
        <Link href="/protected/admin" className="text-muted-foreground hover:text-foreground">Dashboard</Link>
        <Link href="/protected/admin/members" className="text-muted-foreground hover:text-foreground">Members</Link>
        <Link href="/protected/admin/households" className="text-muted-foreground hover:text-foreground">Households</Link>
        <Link href="/protected/admin/membership-requests" className="text-muted-foreground hover:text-foreground">Requests</Link>
        <Link href="/protected/admin/lessons" className="text-muted-foreground hover:text-foreground">Lesson slots</Link>
        <Link href="/protected/admin/invoicing" className="text-muted-foreground hover:text-foreground">Invoicing</Link>
        <Link href="/protected/admin/payments" className="text-muted-foreground hover:text-foreground">Payments</Link>
      </nav>
      {children}
    </div>
  )
}
