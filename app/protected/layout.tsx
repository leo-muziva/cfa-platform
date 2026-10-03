import { LogoutButton } from '@/components/logout-button'
import { getCurrentAccountContext } from '@/lib/services/MemberService'
import { PortalNavigation, type PortalNavigationLink } from '@/components/portal/portal-navigation'
import { SmokeMotionToggle, SmokeyBackground } from '@/components/ui/smokey-background'


export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAccountContext()
  const capabilities = 'error' in context ? null : context.capabilities
  // Member portal bar. Book and Shop live on the main bar instead.
  const links: PortalNavigationLink[] = [
    { href: '/protected', label: 'Profile' },
    { href: '/protected/lessons', label: 'Lessons' },
    { href: '/protected/family', label: 'Family' },
    ...(capabilities?.canSeeHouseholdMoney ? [{ href: '/protected/billing', label: 'Billing' }] : []),
    ...(capabilities?.isCoach ? [{ href: '/protected/coach', label: 'Coach' }] : []),
    ...(capabilities?.canManageStaffArea ? [{ href: '/protected/admin', label: 'Admin' }] : []),
  ]
  
  return (
    // `isolate` keeps the SmokeyBackground's -z-10 canvas pinned inside this
    // stacking context instead of falling behind the whole page.
    <main className="relative isolate min-h-[calc(100vh-var(--site-nav-height))] bg-[#faf7ff] text-foreground dark:bg-[#140a2e]">
      <SmokeyBackground />
      <div className="flex min-h-[calc(100vh-var(--site-nav-height))] w-full flex-col">
        {/* "Hello, name" is in the main bar, so this bar just has Logout. */}
        <PortalNavigation links={links} authSlot={capabilities ? <LogoutButton /> : null} />
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
          <div className="portal-glass rounded-[2rem] border border-white/50 bg-white/[0.62] p-5 text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/15 dark:bg-[#140a2e]/70 dark:shadow-[0_28px_90px_rgba(0,0,0,0.30)] dark:backdrop-blur-xl sm:p-8">
            {children}
          </div>
        </div>
        <footer className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-8">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#140a2e]/10 bg-white/70 px-5 py-5 text-xs text-[#140a2e] backdrop-blur-md dark:border-white/10 dark:bg-black/40 dark:text-white/90 sm:px-8">
            <p>&copy; 2026 Cape Fencing Academy</p>
            <SmokeMotionToggle />
          </div>
        </footer>
      </div>
    </main>
  )
}
