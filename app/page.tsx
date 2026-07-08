import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

// Interim landing page (issue #29) — replaced by the full public site in #12.
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/" className="font-semibold">
              Cape Fencing Academy
            </Link>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>

        <section className="flex-1 flex flex-col items-center justify-center gap-6 max-w-2xl px-5 py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Cape Fencing Academy
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Fencing coaching and club membership in Cape Town. Members can
            manage their profile, membership, and invoices online.
          </p>
          <div className="flex gap-3 mt-2">
            <Button asChild size="lg">
              <Link href="/auth/login">Member login</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/sign-up">Join the academy</Link>
            </Button>
          </div>
        </section>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p>© 2026 Cape Fencing Academy</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
