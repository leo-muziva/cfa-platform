"use client";

import * as React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { motion, useReducedMotion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  icon?: string;
  iconPosition?: "left" | "right";
}

export interface FaqAccordionProps {
  data: FaqItem[];
  className?: string;
  timestamp?: string;
  questionClassName?: string;
  answerClassName?: string;
}

export function FaqAccordion({ data, className, timestamp, questionClassName, answerClassName }: FaqAccordionProps) {
  const [openItem, setOpenItem] = React.useState("");
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={cn("rounded-[2rem] border border-border/70 bg-background/80 p-4 shadow-[0_18px_55px_rgba(45,23,107,0.08)] sm:p-6", className)}>
      <div className="mx-auto w-full max-w-[44rem]">
      {timestamp && <p className="mb-6 text-center text-xs font-medium tracking-wide text-muted-foreground">{timestamp}</p>}
      <Accordion.Root type="single" collapsible value={openItem} onValueChange={setOpenItem}>
        {data.map((item) => {
          const isOpen = openItem === String(item.id);
          return (
            <Accordion.Item key={item.id} value={String(item.id)} className="mb-5 last:mb-0">
              <Accordion.Header>
                <Accordion.Trigger className={cn("group flex w-full items-end gap-3 rounded-2xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-gold", questionClassName)}>
                  <span className={cn("flex max-w-[88%] items-center rounded-[1.35rem] rounded-bl-md border border-border/70 bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-sm transition-colors group-hover:border-cfa-purple/30 group-hover:bg-muted/70 sm:max-w-[78%] sm:text-base", isOpen && "border-cfa-purple/30 bg-muted/70")}>
                    {item.question}
                  </span>
                  <span className="mb-2 shrink-0 text-[#8a6810] dark:text-cfa-gold" aria-hidden="true">
                    {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden">
                <motion.div initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: shouldReduceMotion ? 0 : 0.25 }} className="ml-auto mr-2 mt-3 max-w-[88%] pb-5 sm:max-w-[75%]">
                  <div className="relative">
                    <p className={cn("relative z-10 rounded-[1.35rem] rounded-br-md bg-cfa-purple px-4 py-3 text-sm leading-relaxed text-white shadow-[0_10px_24px_rgba(45,23,107,0.22)] sm:text-base", answerClassName)}>{item.answer}</p>
                    <span className="absolute -bottom-1 right-2 h-3 w-3 rotate-45 bg-cfa-purple" aria-hidden="true" />
                    {item.icon && (
                      <span
                        className={cn("absolute -bottom-3 z-20 rounded-full border border-border/70 bg-card px-2 py-0.5 text-sm shadow-md", item.iconPosition === "right" ? "right-5" : "left-5")}
                        role="img"
                        aria-label={item.icon === "❤️" ? "Liked answer" : "Reaction"}
                      >
                        {item.icon}
                      </span>
                    )}
                  </div>
                </motion.div>
              </Accordion.Content>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
      </div>
    </div>
  );
}
