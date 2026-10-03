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
  { href: "/protected", label: "Member Portal" },
] as const;

// Pages under /protected that have their own main bar button. Every other
// /protected page is part of the member portal.
const OWN_BUTTON = ["/protected/book", "/protected/membership", "/protected/shop"];

export function isMainLinkCurrent(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/protected") {
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

export function SiteNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Close the phone menu on Escape or a click outside it.
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
          <span className="whitespace-nowrap md:hidden lg:inline">Cape Fencing Academy</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {MAIN_LINKS.map((link) => {
            const current = isMainLinkCurrent(link.href, pathname);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${FOCUS} ${
                    current
                      ? "bg-[#140a2e] text-white dark:bg-white dark:text-[#140a2e]"
                      : "text-[#140a2e]/80 hover:bg-[#140a2e]/10 hover:text-[#140a2e] dark:text-white/80 dark:hover:bg-white/15 dark:hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle />
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-[#140a2e]/15 hover:bg-[#140a2e]/10 dark:ring-white/20 dark:hover:bg-white/15 md:hidden ${FOCUS}`}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {/* Phone menu: same five links, stacked. */}
        <div
          ref={menuRef}
          id="site-menu"
          inert={!menuOpen}
          className={`absolute inset-x-4 top-full mt-2 rounded-2xl border border-[#140a2e]/10 bg-white p-2 shadow-2xl transition-all dark:border-white/15 dark:bg-zinc-950 md:hidden ${
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
                        ? "bg-[#140a2e] text-white dark:bg-white dark:text-[#140a2e]"
                        : "hover:bg-[#140a2e]/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
