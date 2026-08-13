import { EnvVarWarning } from '@/components/env-var-warning'
import { AuthButton } from '@/components/auth-button'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { hasEnvVars } from '@/lib/utils'
import { getCurrentAccountContext } from '@/lib/services/MemberService'
import Link from 'next/link'
import { Suspense } from 'react'
import { BackButton } from '@/components/back-button'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAccountContext()
  const capabilities = 'error' in context ? null : context.capabilities
  const dependentCount = 'error' in context ? 0 : context.householdMembers.filter((m) => m.household_role === 'dependent').length
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(92,64,190,0.36),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(20,154,151,0.22),_transparent_32%),#08090d] text-white">
      <div className="flex min-h-screen w-full flex-col">
        <nav aria-label="Member Portal navigation" className="sticky top-0 z-30 border-b border-white/15 bg-black/40 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <Link href="/protected" className="flex shrink-0 items-center gap-3 rounded-xl font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[10px] font-bold tracking-widest text-black">CFA</span>
                <span className="hidden sm:inline">Member Portal</span>
              </Link>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <div className="liquid-glass flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full p-1 text-sm text-white/75 lg:flex-none">
                <Link href="/protected" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Overview</Link>
                <Link href="/protected/book" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Book</Link>
                <Link href="/protected/lessons" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Lessons</Link>
                <Link href="/protected/membership-request" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Membership</Link>
                <Link href="/protected/family" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Family</Link>
                {capabilities?.isPayer && dependentCount > 0 && <Link href="/protected/dependents" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Dependents</Link>}
                {capabilities?.canSeeHouseholdMoney && <Link href="/protected/billing" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Billing</Link>}
                <Link href="/protected/profile" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Profile</Link>
                {capabilities?.canManageStaffArea && <Link href="/protected/admin" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Admin</Link>}
              </div>
              <div className="shrink-0">{!hasEnvVars ? <EnvVarWarning /> : <Suspense><AuthButton /></Suspense>}</div>
            </div>
          </div>
        </nav>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
          <div className="rounded-[2rem] border border-white/30 bg-white/[0.96] p-5 text-slate-950 shadow-[0_28px_90px_rgba(0,0,0,0.30)] backdrop-blur-2xl sm:p-8">
          <BackButton
            fallback="/protected"
            rootFallback="/"
            routeFallbacks={[{ prefix: '/protected/admin', target: '/protected/admin' }]}
            className="mb-8 w-fit border-slate-300 bg-white text-slate-800 hover:bg-slate-100 focus-visible:outline-slate-950"
          />
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
