"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface PortalNavigationLink {
  href: string;
  label: string;
}

const linkClass =
  "rounded-full px-3 py-2 text-sm transition-colors hover:bg-[#140a2e]/10 hover:text-[#140a2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#140a2e] dark:hover:bg-white/15 dark:hover:text-white dark:focus-visible:outline-white";

export function PortalNavigation({
  links,
  authSlot,
}: {
  links: PortalNavigationLink[];
  authSlot: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

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

  const isCurrent = (href: string) =>
    href === "/protected" ? pathname === href : pathname.startsWith(href);

  return (
    <nav aria-label="Member Portal navigation" className="sticky top-0 z-30 border-b border-[#140a2e]/10 bg-white/70 backdrop-blur-xl dark:border-white/15 dark:bg-black/40">
      <div className="relative grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-8 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 shrink-0 items-center gap-2 justify-self-start">
          <Link
            href="/"
            aria-label="Back to Cape Fencing Academy home"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#140a2e] transition-colors hover:bg-[#140a2e]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#140a2e] dark:text-white dark:hover:bg-white/15 dark:focus-visible:outline-white"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="/" aria-label="Cape Fencing Academy home" className="flex min-w-0 items-center gap-3 rounded-xl font-semibold text-[#140a2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#140a2e] dark:text-white dark:focus-visible:outline-white">
            <Image src="/media/brand/cfa-crest.png" alt="" width={40} height={40} priority className="h-10 w-10 rounded-full object-cover" />
            <span className="hidden sm:inline">Member Portal</span>
          </Link>
        </div>

        <div className="liquid-glass hidden items-center gap-1 justify-self-center rounded-full p-1 text-[#140a2e]/80 ring-1 ring-[#140a2e]/10 dark:text-white/75 dark:ring-0 xl:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined} className={`${linkClass} ${isCurrent(link.href) ? "bg-[#140a2e]/10 text-[#140a2e] dark:bg-white/15 dark:text-white" : ""}`}>
                {link.label}
              </Link>
            ))}
        </div>

        <div className="hidden shrink-0 justify-self-end xl:block">{authSlot}</div>

        <div className="flex items-center gap-3 justify-self-end xl:hidden">
          <div className="hidden sm:block">{authSlot}</div>
          <button ref={buttonRef} type="button" aria-label={menuOpen ? "Close portal menu" : "Open portal menu"} aria-expanded={menuOpen} aria-controls="portal-menu" onClick={() => setMenuOpen((open) => !open)} className="liquid-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-[#140a2e] ring-1 ring-[#140a2e]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#140a2e] dark:text-white dark:ring-0 dark:focus-visible:outline-white">
            {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            Menu
          </button>
        </div>

        <div ref={menuRef} id="portal-menu" inert={!menuOpen} className={`absolute left-5 right-5 top-full mt-2 rounded-2xl border border-[#140a2e]/10 bg-white p-3 shadow-2xl dark:border-white/15 dark:bg-slate-950/95 backdrop-blur-xl transition-all sm:left-auto sm:right-8 sm:w-72 xl:hidden ${menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined} className={`block rounded-xl px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#140a2e] dark:focus-visible:outline-white ${isCurrent(link.href) ? "bg-[#140a2e]/10 text-[#140a2e] dark:bg-white/15 dark:text-white" : "text-[#140a2e]/80 hover:bg-[#140a2e]/5 hover:text-[#140a2e] dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"}`}>
              {link.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-[#140a2e]/10 pt-3 dark:border-white/10 sm:hidden">{authSlot}</div>
        </div>
      </div>
    </nav>
  );
}
