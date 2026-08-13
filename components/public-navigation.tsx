"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70";

export function PublicNavigation({ authSlot }: { authSlot: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <nav className="fixed inset-x-3 top-3 z-50 md:inset-x-8" aria-label="Public navigation">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className={`flex h-8 items-center gap-3 text-sm font-semibold uppercase tracking-widest text-white md:text-base ${FOCUS_RING}`}
        >
          <Image
            src="/cfa-crest.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-8 w-8 rounded-full object-cover"
          />
          Cape Fencing
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex">{authSlot}</div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full liquid-glass sm:hidden ${FOCUS_RING}`}
          >
            <Menu
              className={`absolute h-5 w-5 text-white transition-all duration-300 ${
                menuOpen ? "rotate-180 scale-50 opacity-0" : "opacity-100"
              }`}
            />
            <X
              className={`absolute h-5 w-5 text-white transition-all duration-300 ${
                menuOpen ? "opacity-100" : "-rotate-180 scale-50 opacity-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div
        id="public-mobile-menu"
        inert={!menuOpen}
        className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/15 bg-gray-950/95 p-4 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 sm:hidden ${
          menuOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        <div className="sm:hidden">{authSlot}</div>
      </div>
    </nav>
  );
}
