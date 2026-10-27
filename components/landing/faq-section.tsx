import { FaqAccordion, type FaqItem } from "@/components/ui/faq-chat-accordion";

// Home page questions and answers. Edit here to change them.
const FAQS: FaqItem[] = [
  { id: 1, question: "How do I start fencing?", answer: "Start with the beginner package: four one-on-one lessons with a coach, to use within three months. After that you can join the club and train at every session." },
  { id: 2, question: "What should I bring?", answer: "Indoor court shoes, tracksuit pants, a T-shirt, a towel and water. We lend beginners all the fencing kit." },
  { id: 3, question: "Do I need my own equipment?", answer: "No. The club lends you everything you need, so you can start fencing without buying any kit." },
  { id: 4, question: "I’m an experienced fencer visiting Cape Town. Can I train?", answer: "Yes, you’re very welcome. Come along to any club session." },
  { id: 5, question: "Why become a member?", answer: "Members can attend every club session, from footwork drills to sparring, and fence on electronic scoring. Membership also gives you entry to provincial and national competitions, and it helps keep the venue, coaches and equipment going." },
];

/** The FAQ section of the home page. */
export function FaqSection() {
  return (
    <section id="faq" className="relative bg-muted/30 px-4 py-20 text-primary sm:px-6 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#8a6810] dark:text-cfa-gold">Questions</p>
        <h2 className="mb-4 text-3xl font-normal tracking-[-0.04em] md:text-5xl">Before your first bout</h2>
        <FaqAccordion data={FAQS} className="mx-auto mt-12 max-w-5xl md:mt-16" />
      </div>
    </section>
  );
}
