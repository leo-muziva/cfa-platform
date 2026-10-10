import { Pricing, PricingCard, type PricingCardPlan } from "@/components/ui/pricing";
import type { PublicPricingPlan } from "@/lib/services/public-membership-service";
import { formatRands } from "@/lib/money";

// Prices on the membership page: the beginner package on its own at the top,
// then the three membership terms side by side. Prices come from the
// database. Buttons go to the apply form further down the page with that
// plan picked, and are left out when there's no form to go to.

export function termLabel(months: number | null) {
  if (!months || months === 1) return "Month to month";
  return `${months} months`;
}

const NUMBER_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

// "three months", read from the plan so the text follows the database.
export function monthsInWords(months: number) {
  const word = NUMBER_WORDS[months] ?? String(months);
  return months === 1 ? `${word} month` : `${word} months`;
}

const PLAN_BADGES: Partial<Record<string, string>> = {
  six_month: "Pay once for 6 months",
  twelve_month: "Pay once for the year",
};

function applyHref(code: string) {
  return `/protected/membership?plan=${code}#apply-membership`;
}

const MEMBERSHIP_FEATURES = [
  "Attend every club session",
  "Use club equipment if you don’t have your own",
];

// Turns the database plans into the cards on the page: the beginner package
// on its own, then the three membership terms in order. Plans without a
// price are left out, and so are the buttons when there's no form to go to.
export function membershipPricingCards(plans: PublicPricingPlan[], showButtons: boolean) {
  const priced = (code: PublicPricingPlan["code"]) =>
    plans.find((plan): plan is PublicPricingPlan & { price: number } => plan.code === code && plan.price !== null);

  const beginnerPlan = priced("beginner_package");
  const beginner: PricingCardPlan | null = beginnerPlan
    ? {
        key: beginnerPlan.code,
        name: "Beginner package",
        priceLabel: formatRands(beginnerPlan.price),
        features: [
          "Four one-on-one lessons with a coach",
          ...(beginnerPlan.termMonths ? [`To use within ${monthsInWords(beginnerPlan.termMonths)}`] : []),
          "Club kit is provided",
        ],
        buttonText: "Get started",
        href: showButtons ? applyHref(beginnerPlan.code) : undefined,
      }
    : null;

  const terms = (["month_to_month", "six_month", "twelve_month"] as const)
    .map((code) => priced(code))
    .filter((plan) => plan !== undefined)
    .map((plan): PricingCardPlan => {
      const months = plan.termMonths ?? 1;
      return {
        key: plan.code,
        name: termLabel(plan.termMonths),
        priceLabel: formatRands(plan.price),
        period: months > 1 ? undefined : "month",
        note: plan.joiningFee ? `+ ${formatRands(plan.joiningFee)} joining fee` : undefined,
        badge: PLAN_BADGES[plan.code],
        features: [...MEMBERSHIP_FEATURES, months > 1 ? `Covers ${monthsInWords(months)}` : "Pay month by month"],
        buttonText: "Apply",
        href: showButtons ? applyHref(plan.code) : undefined,
      };
    });

  return { beginner, terms };
}

export function MembershipPlans({
  plans,
  showButtons,
}: {
  plans: PublicPricingPlan[];
  showButtons: boolean;
}) {
  const { beginner, terms } = membershipPricingCards(plans, showButtons);

  return (
    <div className="mx-auto max-w-5xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6810] dark:text-cfa-gold">
        Membership
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-cfa-purple dark:text-white sm:text-5xl">
        Join the club
      </h1>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        New to fencing? Start with the beginner package, then join when you are ready to train regularly.
      </p>

      {beginner && (
        <PricingCard
          plan={beginner}
          className="mx-auto mt-10 max-w-sm border-cfa-gold/90 shadow-[0_0_0_6px_rgba(255,210,28,0.08),0_20px_50px_rgba(45,23,107,0.08)] dark:border-cfa-gold/90"
        />
      )}

      {terms.length > 0 && (
        <>
          <h2 className="mb-8 mt-14 text-2xl font-semibold tracking-tight text-cfa-purple dark:text-white">
            Membership
          </h2>
          <Pricing plans={terms} />
        </>
      )}
    </div>
  );
}
