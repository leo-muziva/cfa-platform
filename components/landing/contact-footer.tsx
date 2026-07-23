"use client";

import { Mail, MapPin, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  PUBLIC_CONTACT_LINKS,
  PUBLIC_LEGAL_LINKS,
} from "@/lib/public-site";

const CONTACT_ICONS = {
  location: MapPin,
  email: Mail,
  facebook: Users,
} as const;

export function ContactFooter() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="contact"
      className="relative bg-white text-[#25145c] px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#8a6810] mb-3">
          Get in Touch
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Find us in Rondebosch.
        </h2>

        <div className="grid md:grid-cols-2 gap-10 mt-12 md:mt-16">
          <motion.ul
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 24, filter: "blur(12px)" }
            }
            whileInView={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            {PUBLIC_CONTACT_LINKS.map((row) => {
              const Icon = CONTACT_ICONS[row.id];
              return (
                <li key={row.label}>
                  <a
                    href={row.href}
                    {...(row.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="cfa-light-card rounded-2xl p-6 flex items-center gap-4 hover:text-[#8a6810] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c]"
                  >
                    <Icon size={22} className="shrink-0" aria-hidden="true" />
                    <span>{row.label}</span>
                  </a>
                </li>
              );
            })}
          </motion.ul>

          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 24, filter: "blur(12px)" }
            }
            whileInView={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="cfa-light-card rounded-2xl p-6"
          >
            <h3 className="text-lg font-medium mb-4">Training hours</h3>
            <ul className="space-y-2 text-[#625b73]">
              <li>Tue–Thu 18:30 – 21:30</li>
              <li>Sat 11:00 – 13:30</li>
            </ul>
          </motion.div>
        </div>

        <div className="border-t border-[#2d176b]/10 pt-8 mt-16 flex flex-col sm:flex-row justify-between gap-3 text-sm text-[#625b73]">
          <p>© 2026 Cape Fencing Academy</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <span>Est. 1997 · Rondebosch, Cape Town</span>
            {PUBLIC_LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-[#8a6810] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
