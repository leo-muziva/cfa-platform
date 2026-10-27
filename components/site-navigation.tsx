"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

// The one main bar, on every page. Everything except Home is under
// /protected, so logged out visitors get sent to login by the proxy and
// come back to the page they clicked afterwards.
export const MAIN_LINKS = [
  { href: "/", label: "Home" },
  { href: "/protected/book", label: "Book" },
  { href: "/protected/membership", label: "Membership" },
  { href: "/protected/shop", label: "Shop" },
] as const;

// The Member Portal button sits on its own on the right, with the login
// status (components/site-auth.tsx).
export const MEMBER_PORTAL_HREF = "/protected";

// Pages under /protected that have their own main bar button. Every other
// /protected page is part of the member portal.
const OWN_BUTTON = ["/protected/book", "/protected/membership", "/protected/shop"];

/** Whether a main bar link should show as the current page. */
export function isMainLinkCurrent(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === MEMBER_PORTAL_HREF) {
    return (
      pathname.startsWith("/protected") &&
      pathname !== "/protected/info" &&
      !OWN_BUTTON.some((path) => pathname === path || pathname.startsWith(path + "/"))
    );
  }
  return pathname === href || pathname.startsWith(href + "/");
}

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#140a2e] dark:focus-visible:outline-white";

// Solid button, so it reads as the way into the portal. A ring shows when
// you're already inside it.
export function MemberPortalLink() {
  const pathname = usePathname();
  const current = isMainLinkCurrent(MEMBER_PORTAL_HREF, pathname);
  return (
    <Link
      href={MEMBER_PORTAL_HREF}
      aria-current={current ? "page" : undefined}
      className={`whitespace-nowrap rounded-full bg-[#140a2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#140a2e]/90 dark:bg-white dark:text-[#140a2e] dark:hover:bg-white/90 ${FOCUS} ${
        current ? "ring-2 ring-[#140a2e]/30 ring-offset-2 ring-offset-white dark:ring-white/40 dark:ring-offset-black" : ""
      }`}
    >
      Member Portal
    </Link>
  );
}

/** The site-wide top bar, with a menu on small screens. `authSlot` holds login or the user's name. */
export function SiteNavigation({ authSlot }: { authSlot: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Close the menu on Escape or a click outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-40 border-b border-[#140a2e]/10 bg-white/85 text-[#140a2e] backdrop-blur-xl dark:border-white/15 dark:bg-black/70 dark:text-white"
    >
      <div className="relative mx-auto flex h-[calc(var(--site-nav-height)-1px)] w-full items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          href="/"
          aria-label="Cape Fencing Academy home"
          className={`flex shrink-0 items-center gap-3 rounded-xl font-semibold ${FOCUS}`}
        >
          <Image
            src="/media/brand/cfa-crest.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-full object-cover"
          />
          <span className="whitespace-nowrap">Cape Fencing Academy</span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {MAIN_LINKS.map((link) => {
            const current = isMainLinkCurrent(link.href, pathname);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${FOCUS} ${
                    current
                      ? "bg-[#140a2e]/10 font-semibold text-[#140a2e] dark:bg-white/15 dark:text-white"
                      : "font-medium text-[#140a2e]/80 hover:bg-[#140a2e]/5 hover:text-[#140a2e] dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex shrink-0 items-center gap-4">
          <ThemeToggle />
          <div className="hidden lg:block">{authSlot}</div>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-[#140a2e]/15 hover:bg-[#140a2e]/10 dark:ring-white/20 dark:hover:bg-white/15 lg:hidden ${FOCUS}`}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {/* Smaller screens: the page links stacked, then the login status
            and Member Portal button. */}
        <div
          ref={menuRef}
          id="site-menu"
          inert={!menuOpen}
          className={`absolute inset-x-4 top-full mt-2 rounded-2xl border border-[#140a2e]/10 bg-white p-2 shadow-2xl transition-all dark:border-white/15 dark:bg-zinc-950 sm:left-auto sm:right-8 sm:w-80 lg:hidden ${
            menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
          }`}
        >
          <ul>
            {MAIN_LINKS.map((link) => {
              const current = isMainLinkCurrent(link.href, pathname);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`block rounded-xl px-4 py-3 text-sm font-medium ${FOCUS} ${
                      current
                        ? "bg-[#140a2e]/10 dark:bg-white/15"
                        : "hover:bg-[#140a2e]/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-[#140a2e]/10 px-2 pb-1 pt-3 dark:border-white/10">{authSlot}</div>
        </div>
      </div>
    </nav>
  );
}
