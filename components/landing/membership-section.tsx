import { Pricing } from "@/components/ui/pricing";
import { getPublicPricingPlans } from "@/lib/services/public-membership-service";
import { cn } from "@/lib/utils";

export async function MembershipSection({ className, ctaHref }: { className?: string; ctaHref?: string } = {}) {
  const plans = await getPublicPricingPlans();

  return (
    <section id="membership" className={cn("relative bg-background px-4 py-20 text-primary sm:px-6 md:px-12 md:py-28", className)}>
      <div className="mx-auto max-w-6xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#8a6810] dark:text-cfa-gold">Membership</p>
        <h2 className="mb-4 text-3xl font-normal tracking-[-0.04em] md:text-5xl">Choose how you fence.</h2>
        <p className="max-w-2xl text-muted-foreground">Find a membership term that suits your training, or begin with four introductory lessons.</p>
        <Pricing plans={plans} ctaHref={ctaHref} className="mt-12 md:mt-16" />
        <p className="mt-8 text-sm text-muted-foreground">Prices shown are provisional and subject to CFA confirmation. Joining fees and lesson charges may apply separately.</p>
      </div>
    </section>
  );
}
