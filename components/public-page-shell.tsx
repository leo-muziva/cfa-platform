import { Suspense } from "react";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { HeroAuth } from "@/components/hero-auth";
import { PublicNavigation } from "@/components/public-navigation";
import { PUBLIC_CONTACT_LINKS, PUBLIC_LEGAL_LINKS } from "@/lib/public-site";
import { hasEnvVars } from "@/lib/utils";

function PublicAuthSlot() {
  return hasEnvVars ? (
    <Suspense>
      <HeroAuth />
    </Suspense>
  ) : (
    <EnvVarWarning />
  );
}

export function PublicPageShell({
  eyebrow = "Cape Fencing Academy",
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white text-[#25145c]">
      <PublicNavigation authSlot={<PublicAuthSlot />} />

      <header className="relative overflow-hidden bg-black px-4 pb-20 pt-28 text-white sm:px-6 md:px-12 md:pb-24 md:pt-36">
        <div className="pointer-events-none absolute -left-32 top-4 h-80 w-80 rounded-full bg-[#2d176b]/60 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#ffd21c]/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <BackButton
            fallback="/"
            useHistory={false}
            className="mb-10 text-white liquid-glass focus-visible:outline-white/70"
          />
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#f0c71b]">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl text-4xl font-normal tracking-[-0.04em] sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray-300">{intro}</p>
        </div>
      </header>

      <section className="relative bg-white px-4 py-16 sm:px-6 md:px-12 md:py-20">
        <div className="mx-auto max-w-6xl">{children}</div>
      </section>

      <footer className="border-t border-[#2d176b]/10 bg-[#faf9fd] px-4 py-10 text-sm text-[#625b73] sm:px-6 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-8">
          <div className="flex max-w-md flex-col gap-2">
            <span>© 2026 Cape Fencing Academy</span>
            {PUBLIC_CONTACT_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="underline-offset-4 hover:text-[#8a6810] hover:underline"
              >
                {link.shortLabel}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap content-start gap-4">
            {PUBLIC_LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="underline-offset-4 hover:text-[#8a6810] hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
