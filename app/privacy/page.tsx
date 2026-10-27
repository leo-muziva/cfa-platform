import { PublicPageShell } from "@/components/public-page-shell";

/** /privacy: placeholder until CFA supplies the approved privacy notice. */
export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Privacy / POPIA"
      intro="CFA's approved privacy notice will be published here."
    >
      <article className="cfa-light-card max-w-3xl rounded-2xl p-6 md:p-8">
        <h2 className="text-2xl tracking-[-0.03em]">How platform information is protected</h2>
        <p className="mt-4 leading-7 text-[#625b73]">
          The platform records consent timestamps and restricts personal and
          household financial information through database access policies.
          This is not a substitute for CFA-approved legal wording.
        </p>
      </article>
    </PublicPageShell>
  );
}
