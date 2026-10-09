import Link from "next/link";
import { PUBLIC_LEGAL_LINKS } from "@/lib/public-site";

// Copyright and legal links at the bottom of the home page.
export function SiteFooter() {
  return (
    <footer className="bg-background px-4 pb-10 sm:px-6 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 border-t border-cfa-purple/10 pt-8 text-sm text-muted-foreground sm:flex-row">
        <p>© 2026 Cape Fencing Academy</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span>Est. 1997 · Rondebosch, Cape Town</span>
          {PUBLIC_LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-[#8a6810] dark:hover:text-cfa-gold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cfa-gold"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
