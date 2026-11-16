import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public-page-shell";
import { PUBLIC_CONTACT_LINKS } from "@/lib/public-site";

export const metadata: Metadata = {
  title: "Privacy Policy | Cape Fencing Academy",
  description:
    "How Cape Fencing Academy collects, uses and protects personal information on its member platform.",
};

const LAST_UPDATED = "16 November 2026";

const contactEmail = PUBLIC_CONTACT_LINKS.find((link) => link.id === "email");

interface PolicySection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  /** Shown after the list. */
  closing?: string;
}

// Kept as data so the page stays one readable list of sections. Google's
// OAuth verification reads this page, so it must name the Google data used.
const SECTIONS: PolicySection[] = [
  {
    heading: "Who we are",
    paragraphs: [
      "Cape Fencing Academy (CFA) is a fencing club at the Belvedere Community Centre, 9 Chess Road, Rondebosch, Cape Town. This policy explains how the CFA member platform (this website) collects, uses, shares and protects personal information, in line with the Protection of Personal Information Act, 2013 (POPIA). CFA is the responsible party for the information described here.",
    ],
  },
  {
    heading: "Information we collect",
    paragraphs: ["We only collect what we need to run memberships, lessons and club orders:"],
    items: [
      "Account details: your name, email address and password (stored only as a secure hash by our authentication provider).",
      "Profile details: phone number, date of birth and emergency contact name and phone number.",
      "Family links: which accounts are linked as a guardian, dependent or payer, and when consent to pay was given.",
      "Membership records: applications, membership type, status and history.",
      "Lesson records: bookings, coach, time, attendance, cancellations and reschedules.",
      "Billing records: charges, invoices, receipts, payment status, refunds and credits. We never see or store your full card number.",
      "Shop orders: items ordered, sizes and handedness, and order status.",
      "Consent records: when you accepted these terms and this policy.",
      "Technical data: secure session cookies that keep you signed in, and standard server logs (such as IP address and browser type) kept by our hosting providers for security.",
    ],
  },
  {
    heading: "Signing in with Google",
    paragraphs: [
      "If you choose \"Continue with Google\", Google shares your name, email address and profile picture with us, and confirms that your email address is verified. We use your name and email address only to create and identify your CFA account and to contact you about your membership, lessons and orders. We do not use your profile picture.",
      "We do not request access to your Gmail, contacts, calendar, Drive or any other Google data, and we never post anything on your behalf. Our use of information received from Google APIs follows the Google API Services User Data Policy, including the Limited Use requirements. You can remove CFA's access at any time from your Google Account under Security, then Third-party apps and services.",
    ],
  },
  {
    heading: "How we use your information",
    items: [
      "To create and secure your account and confirm your email address.",
      "To process membership applications and keep membership records.",
      "To let you, or your guardian, book, cancel and reschedule lessons, and to let coaches manage their sessions and attendance.",
      "To issue invoices, take payments, process refunds and keep financial records the club is required to keep.",
      "To send service emails, such as sign-up confirmations, password resets, payment requests and order confirmations.",
      "To keep emergency contact details available to club staff for your safety during training.",
    ],
    closing:
      "We do not sell your personal information, use it for advertising, or send marketing email without your consent.",
  },
  {
    heading: "Children and families",
    paragraphs: [
      "Fencers under 18 take part through a linked guardian account. The guardian manages the dependent's account, gives consent on their behalf and is responsible for payments. Dependent accounts cannot see money or billing information. Linking, unlinking or transferring a family account requires approval from club staff.",
    ],
  },
  {
    heading: "Who can see your information",
    paragraphs: [
      "Access inside the platform is limited by database security rules, so members only see their own records and those of dependents they are responsible for. Coaches see the bookings and attendance for their own lessons. Club staff see what they need to run the club, including membership and billing records.",
      "We use these service providers, who process information only on our instructions:",
    ],
    items: [
      "Supabase: database and sign-in (authentication) hosting.",
      "Vercel: website hosting.",
      "Google: optional sign-in with Google, and email delivery through a club Gmail account.",
      "PayFast: card and online payment processing. Payment details you enter go directly to PayFast.",
    ],
  },
  {
    heading: "Information stored outside South Africa",
    paragraphs: [
      "Some of these providers store or process information on servers outside South Africa. We choose providers that protect personal information to a standard comparable to POPIA.",
    ],
  },
  {
    heading: "AI-assisted tools",
    paragraphs: [
      "Club staff can use an AI tool to check supplier order sheets for errors. It only receives product lines (items, sizes and quantities). No member names, email addresses, phone numbers or other personal information are sent to it.",
    ],
  },
  {
    heading: "How long we keep information",
    paragraphs: [
      "We keep account and membership information while your account is active. Invoices, payments and refunds are kept for at least five years, as South African tax law requires. When information is no longer needed, we delete it or anonymise it.",
    ],
  },
  {
    heading: "How we protect information",
    paragraphs: [
      "All traffic uses HTTPS. Passwords are hashed, privileged keys stay on the server, and database security rules restrict every table to the people allowed to see it. Issued invoices cannot be edited, and financial changes are recorded in an audit trail.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: ["Under POPIA you may:"],
    items: [
      "Ask what personal information we hold about you and get a copy of it.",
      "Ask us to correct or update inaccurate information. You can edit most profile details yourself.",
      "Ask us to delete your account and information, except records we are required by law to keep.",
      "Object to how we use your information, or withdraw consent, including disconnecting Google sign-in.",
      "Complain to the Information Regulator (South Africa) at inforeg.org.za.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "We may update this policy as the platform changes. The date at the top shows the latest version. If a change is significant, we will tell members by email or with a notice on the platform.",
    ],
  },
];

/** /privacy: the platform privacy policy, also used as the Google OAuth privacy policy URL. */
export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      intro={`How Cape Fencing Academy handles your personal information. Last updated ${LAST_UPDATED}.`}
    >
      <article className="cfa-light-card max-w-3xl rounded-2xl p-6 md:p-8">
        {SECTIONS.map((section, index) => (
          <section key={section.heading} className={index === 0 ? undefined : "mt-10"}>
            <h2 className="text-2xl tracking-[-0.03em]">{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-4 leading-7 text-[#625b73]">
                {paragraph}
              </p>
            ))}
            {section.items ? (
              <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-[#625b73]">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.closing ? (
              <p className="mt-4 leading-7 text-[#625b73]">{section.closing}</p>
            ) : null}
          </section>
        ))}

        <section className="mt-10">
          <h2 className="text-2xl tracking-[-0.03em]">Contact us</h2>
          <p className="mt-4 leading-7 text-[#625b73]">
            For privacy questions or requests, email{" "}
            {contactEmail ? (
              <a href={contactEmail.href} className="font-medium text-[#2d176b] underline">
                {contactEmail.label}
              </a>
            ) : (
              "the club"
            )}
            . We aim to respond within 30 days.
          </p>
        </section>
      </article>
    </PublicPageShell>
  );
}
