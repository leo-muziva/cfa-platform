"use client";

import { Mail, MapPin, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const CONTACT_ROWS = [
  {
    icon: MapPin,
    label: "Belvedere Community Centre, 9 Chess Road, Rondebosch, Cape Town",
    href: "https://maps.google.com/?cid=1423116138085293119",
    external: true,
  },
  {
    icon: Mail,
    label: "jeremy@capefencingacademy.com",
    href: "mailto:jeremy@capefencingacademy.com",
    external: false,
  },
  {
    icon: Users,
    label: "Fencing Western Cape community",
    href: "https://www.facebook.com/groups/FencingWC/",
    external: true,
  },
] as const;

export function ContactFooter() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="contact"
      className="relative bg-black text-white px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">
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
            {CONTACT_ROWS.map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.label}>
                  <a
                    href={row.href}
                    {...(row.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="liquid-glass rounded-2xl p-6 flex items-center gap-4 hover:text-gray-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
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
            className="liquid-glass rounded-2xl p-6"
          >
            <h3 className="text-lg font-medium mb-4">Training hours</h3>
            <ul className="space-y-2 text-gray-400">
              <li>Tue–Thu 18:30 – 21:30</li>
              <li>Sat 11:00 – 13:30</li>
            </ul>
          </motion.div>
        </div>

        <div className="border-t border-white/10 pt-8 mt-16 flex flex-col sm:flex-row justify-between gap-2 text-sm text-gray-400">
          <p>© 2026 Cape Fencing Academy</p>
          <p>Est. 1997 · Rondebosch, Cape Town</p>
        </div>
      </div>
    </section>
  );
}
