import { PublicPageShell } from "@/components/public-page-shell";

/** /terms: placeholder until CFA supplies the approved terms. */
export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Terms & Conditions"
      intro="CFA's approved platform terms will be published here."
    >
      <article className="cfa-light-card max-w-3xl rounded-2xl p-6 md:p-8">
        <h2 className="text-2xl tracking-[-0.03em]">Account terms</h2>
        <p className="mt-4 leading-7 text-[#625b73]">
          Account creation records acceptance only after the final
          sponsor-approved terms are available.
        </p>
      </article>
    </PublicPageShell>
  );
}
