"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isMainLinkCurrent } from "@/components/site-navigation";

export interface PortalNavigationLink {
  href: string;
  label: string;
}

// Second bar, under the main bar, only on member portal pages (profile,
// lessons, family, billing, coach, admin and the pages under them). Book,
// Shop and Membership have their own main bar buttons, so it doesn't show
// there.
export function PortalNavigation({
  links,
  authSlot,
}: {
  links: PortalNavigationLink[];
  authSlot: React.ReactNode;
}) {
  const pathname = usePathname();
  if (!isMainLinkCurrent("/protected", pathname)) return null;

  // Refunds are reached from Billing, so Billing stays lit there.
  const isCurrent = (href: string) =>
    href === "/protected"
      ? pathname === href || pathname.startsWith("/protected/complete-profile")
      : href === "/protected/billing"
        ? pathname === href || pathname.startsWith("/protected/refunds")
        : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="Member Portal navigation"
      className="border-b border-[#140a2e]/10 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-black/40"
    >
      {/* Links centred, Logout on the right. On narrow screens the links
          scroll sideways rather than wrapping. */}
      <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-8 md:grid md:grid-cols-[1fr_auto_1fr]">
        <ul className="-mx-1 flex min-w-0 max-w-full items-center gap-1 overflow-x-auto px-1 py-1 md:col-start-2 md:mx-0 md:overflow-visible md:px-0">
          {links.map((link) => {
            const current = isCurrent(link.href);
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#140a2e] dark:focus-visible:outline-white ${
                    current
                      ? "bg-[#140a2e]/10 font-medium text-[#140a2e] dark:bg-white/15 dark:text-white"
                      : "text-[#140a2e]/75 hover:bg-[#140a2e]/5 hover:text-[#140a2e] dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0 md:col-start-3 md:justify-self-end">{authSlot}</div>
      </div>
    </nav>
  );
}
