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
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 min-h-16">
          <div className="w-full max-w-5xl flex flex-wrap justify-between items-center p-3 px-5 text-sm gap-3">
            <div className="flex flex-wrap gap-5 items-center font-semibold">
              <Link href="/protected">Cape Fencing Academy</Link>
              <Link href="/protected/book" className="text-muted-foreground font-normal hover:text-foreground">Book</Link>
              <Link href="/protected/lessons" className="text-muted-foreground font-normal hover:text-foreground">Lessons</Link>
              <Link href="/membership-portal" className="text-muted-foreground font-normal hover:text-foreground">Membership Portal</Link>
              <Link href="/protected/family" className="ml-[-0.75rem] text-muted-foreground font-normal hover:text-foreground">Family Accounts</Link>
              {capabilities?.isPayer && dependentCount > 0 && <Link href="/protected/dependents" className="text-muted-foreground font-normal hover:text-foreground">Dependents</Link>}
              {capabilities?.canSeeHouseholdMoney && <Link href="/protected/billing" className="text-muted-foreground font-normal hover:text-foreground">Billing</Link>}
              <Link href="/protected/profile" className="text-muted-foreground font-normal hover:text-foreground">Profile</Link>
              {capabilities?.canManageStaffArea && <Link href="/protected/admin" className="text-muted-foreground font-normal hover:text-foreground">Admin</Link>}
            </div>
            {!hasEnvVars ? <EnvVarWarning /> : <Suspense><AuthButton /></Suspense>}
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-8 w-full max-w-5xl p-5">
          <BackButton
            fallback="/protected"
            rootFallback="/"
            routeFallbacks={[{ prefix: '/protected/admin', target: '/protected/admin' }]}
            className="w-fit border bg-background hover:bg-muted focus-visible:outline-ring"
          />
          {children}
        </div>
        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p className="text-muted-foreground">&copy; 2026 Cape Fencing Academy</p><ThemeSwitcher />
        </footer>
      </div>
    </main>
  )
}
