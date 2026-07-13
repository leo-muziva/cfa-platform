"use client";

import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const FAQS = [
  {
    question: "How do I start fencing?",
    answer:
      "Book a discounted intro lesson, then the beginner package — four individual lessons (R1,000, valid 3 months) — then join the club.",
  },
  {
    question: "What should I bring?",
    answer:
      "Court shoes, tracksuit pants, sports clothes, towel and water. We provide the fencing kit for beginners.",
  },
  {
    question: "Do I need my own equipment?",
    answer:
      "No — the club loans beginners kit until you're ready to buy your own. Gear is available through the club at beginner-friendly prices.",
  },
  {
    question: "I'm an experienced fencer visiting Cape Town — can I train?",
    answer: "Yes. Pay the drop-in fee and join any session.",
  },
  {
    question: "Why become a member?",
    answer:
      "Membership supports the venue, coaches and equipment — and gets you electronic scoring, provincial & national competition entry, and regular training.",
  },
] as const;

export function FaqSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="faq"
      className="relative bg-black text-white px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">
          Questions
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Before your first bout.
        </h2>

        <div className="flex flex-col gap-4 mt-12 md:mt-16">
          {FAQS.map((faq, index) => (
            <motion.details
              key={faq.question}
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
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.08 }}
              className="group liquid-glass rounded-2xl px-6 py-4"
            >
              <summary className="cursor-pointer list-none flex justify-between items-center gap-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 rounded-lg">
                {faq.question}
                <ChevronDown
                  size={20}
                  className="shrink-0 transition-transform duration-300 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="text-gray-400 mt-3">{faq.answer}</p>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}
