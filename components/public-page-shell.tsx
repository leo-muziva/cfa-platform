import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { PUBLIC_CONTACT_LINKS, PUBLIC_LEGAL_LINKS } from "@/lib/public-site";

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
    <main className="min-h-screen bg-background text-primary">
      {/* Header stays permanently dark, same "hero-adjacent" treatment as
          the homepage hero — visual consistency between the two, and no
          unpredictable-background-brightness problem to solve here since
          it's a flat colour, not a video. */}
      <header className="relative overflow-hidden bg-black px-4 pb-20 pt-12 text-white sm:px-6 md:px-12 md:pb-24 md:pt-16">
        <div className="pointer-events-none absolute -left-32 top-4 h-80 w-80 rounded-full bg-[#2d176b]/60 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#ffd21c]/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <BackButton
            fallback="/"
            useHistory={false}
            className="mb-10 text-white liquid-glass focus-visible:outline-white/70"
          />
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cfa-gold">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl text-4xl font-normal tracking-[-0.04em] sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray-300">{intro}</p>
        </div>
      </header>

      <section className="relative bg-background px-4 py-16 sm:px-6 md:px-12 md:py-20">
        <div className="mx-auto max-w-6xl">{children}</div>
      </section>

      <footer className="border-t border-border bg-muted/40 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:px-12">
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
                className="underline-offset-4 hover:text-cfa-gold hover:underline"
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
                className="underline-offset-4 hover:text-cfa-gold hover:underline"
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
