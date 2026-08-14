import { EnvVarWarning } from '@/components/env-var-warning'
import { AuthButton } from '@/components/auth-button'
import { ThemeSwitcher } from '@/components/theme-switcher'
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
    ...(capabilities?.canSeeHouseholdMoney ? [{ href: '/protected/billing', label: 'Billing' }] : []),
    ...(capabilities?.canManageStaffArea ? [{ href: '/protected/admin', label: 'Admin' }] : []),
  ]
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(92,64,190,0.36),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(20,154,151,0.22),_transparent_32%),#08090d] text-white">
      <div className="flex min-h-screen w-full flex-col">
        <PortalNavigation links={links} authSlot={!hasEnvVars ? <EnvVarWarning /> : <Suspense><AuthButton /></Suspense>} />
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
          <div className="rounded-[2rem] border border-white/30 bg-white/[0.96] p-5 text-slate-950 shadow-[0_28px_90px_rgba(0,0,0,0.30)] backdrop-blur-2xl sm:p-8">
            {children}
          </div>
        </div>
        <footer className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-white/15 px-5 py-8 text-xs text-white/60 sm:px-8">
          <p>&copy; 2026 Cape Fencing Academy</p><div className="text-white [&_button]:text-white [&_svg]:text-white"><ThemeSwitcher /></div>
        </footer>
      </div>
    </main>
  )
}
