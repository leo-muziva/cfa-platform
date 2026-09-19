import { EnvVarWarning } from '@/components/env-var-warning'
import { AuthButton } from '@/components/auth-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { hasEnvVars } from '@/lib/utils'
import { getCurrentAccountContext } from '@/lib/services/MemberService'
import { Suspense } from 'react'
import { PortalNavigation, type PortalNavigationLink } from '@/components/portal/portal-navigation'


export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAccountContext()
  const capabilities = 'error' in context ? null : context.capabilities
  const links: PortalNavigationLink[] = [
    { href: '/protected', label: 'Profile' },
    { href: '/protected/book', label: 'Book' },
    { href: '/protected/lessons', label: 'Lessons' },
    { href: '/protected/family', label: 'Family' },
    { href: '/shop', label: 'Shop' },
    ...(capabilities?.canSeeHouseholdMoney ? [{ href: '/protected/billing', label: 'Billing' }] : []),
    ...(capabilities?.isCoach ? [{ href: '/protected/coach', label: 'Coach' }] : []),
    ...(capabilities?.canManageStaffArea ? [{ href: '/protected/admin', label: 'Admin' }] : []),
  ]
  
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_hsl(var(--cfa-purple)/0.30),_transparent_34%),radial-gradient(circle_at_bottom_left,_hsl(var(--cfa-gold)/0.14),_transparent_32%),hsl(var(--background))] text-foreground">
      <div className="flex min-h-screen w-full flex-col">
        <PortalNavigation links={links} authSlot={!hasEnvVars ? <EnvVarWarning /> : <Suspense><AuthButton /></Suspense>} />
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
          <div className="rounded-[2rem] border border-border bg-card/[0.96] p-5 text-card-foreground shadow-[0_28px_90px_rgba(0,0,0,0.30)] backdrop-blur-2xl sm:p-8">
            {children}
          </div>
        </div>
        <footer className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-border px-5 py-8 text-xs text-muted-foreground sm:px-8">
          <p>&copy; 2026 Cape Fencing Academy</p><ThemeToggle />
        </footer>
      </div>
    </main>
  )
}
