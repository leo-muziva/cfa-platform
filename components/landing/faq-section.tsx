import { FaqAccordion, type FaqItem } from "@/components/ui/faq-chat-accordion";

const FAQS: FaqItem[] = [
  { id: 1, question: "How do I start fencing?", answer: "Book a discounted intro lesson, then the beginner package - four individual lessons (R1,000, valid 3 months) - then join the club.", icon: "❤️", iconPosition: "right" },
  { id: 2, question: "What should I bring?", answer: "Court shoes, tracksuit pants, sports clothes, towel and water. We provide the fencing kit for beginners." },
  { id: 3, question: "Do I need my own equipment?", answer: "No - the club loans beginners kit until you're ready to buy your own. Gear is available through the club at beginner-friendly prices." },
  { id: 4, question: "I'm an experienced fencer visiting Cape Town - can I train?", answer: "Yes. Pay the drop-in fee and join any session.", icon: "⭐", iconPosition: "left" },
  { id: 5, question: "Why become a member?", answer: "Membership supports the venue, coaches and equipment - and gets you electronic scoring, provincial & national competition entry, and regular training." },
];

export function FaqSection() {
  return (
    <section id="faq" className="relative bg-muted/30 px-4 py-20 text-primary sm:px-6 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#8a6810] dark:text-cfa-gold">Questions</p>
        <h2 className="mb-4 text-3xl font-normal tracking-[-0.04em] md:text-5xl">Before your first bout.</h2>
        <FaqAccordion data={FAQS} timestamp="CFA Answers · 9:01 AM" className="mx-auto mt-12 max-w-5xl md:mt-16" />
      </div>
    </section>
  );
}
