import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PublicPricingPlan } from "@/lib/services/public-membership-service";

// Prices on the membership page: the beginner package on its own at the top,
// then the three membership terms side by side. Prices come from the
// database. Buttons go to the apply form further down the page with that
// plan picked, and are left out when there's no form to go to.

const whole = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

function rand(amount: number) {
  return "R" + whole.format(amount);
}

export function termLabel(months: number | null) {
  if (!months || months === 1) return "Month to month";
  return `${months} months`;
}

// Saving against paying month to month for the same length, rounded to the
// nearest half percent. Nothing if there's no saving.
export function savingPercent(plan: PublicPricingPlan, monthly: number | null) {
  if (!monthly || !plan.price || !plan.termMonths || plan.termMonths <= 1) return null;
  const saving = (1 - plan.price / (monthly * plan.termMonths)) * 100;
  if (saving < 0.5) return null;
  return Math.round(saving * 2) / 2;
}

function applyHref(code: string) {
  return `/protected/membership?plan=${code}#apply-membership`;
}

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-purple dark:focus-visible:outline-white";

export function MembershipPlans({
  plans,
  showButtons,
}: {
  plans: PublicPricingPlan[];
  showButtons: boolean;
}) {
  const beginner = plans.find((plan) => plan.code === "beginner_package" && plan.price !== null);
  const terms = ["month_to_month", "six_month", "twelve_month"]
    .map((code) => plans.find((plan) => plan.code === code))
    .filter((plan): plan is PublicPricingPlan => Boolean(plan && plan.price !== null));
  const monthly = plans.find((plan) => plan.code === "month_to_month")?.price ?? null;

  return (
    <div className="mx-auto max-w-4xl text-center">
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
        <div className="mx-auto mt-10 max-w-sm rounded-3xl border border-cfa-gold/90 bg-[#ffffff] p-8 shadow-[0_0_0_6px_rgba(255,210,28,0.08),0_20px_50px_rgba(45,23,107,0.08)] dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6810] dark:text-cfa-gold">
            Beginner package
          </p>
          <p className="mt-3 text-5xl font-semibold tracking-tight text-cfa-purple dark:text-white">
            {rand(beginner.price!)}
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Four individual beginner lessons.
            {beginner.termMonths ? ` Valid for ${beginner.termMonths} months.` : ""} Club kit for these lessons.
          </p>
          {showButtons && (
            <Link
              href={applyHref(beginner.code)}
              className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-cfa-purple px-6 py-2.5 font-medium text-white hover:bg-cfa-purple/90 dark:bg-white dark:text-cfa-purple dark:hover:bg-white/90 ${FOCUS}`}
            >
              Get started
            </Link>
          )}
        </div>
      )}

      {terms.length > 0 && (
        <>
          <h2 className="mt-14 font-semibold text-cfa-purple dark:text-white">Membership</h2>
          <p className="mx-auto mt-1 max-w-lg text-muted-foreground">
            A monthly membership gives you access to all of the club&rsquo;s training times, and club
            equipment if you don&rsquo;t have your own.
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {terms.map((plan) => {
              const saving = savingPercent(plan, monthly);
              return (
                <li
                  key={plan.code}
                  className="flex flex-col items-center rounded-2xl border border-[#140a2e]/10 bg-[#ffffff] px-6 py-7 shadow-[0_10px_30px_rgba(45,23,107,0.05)] dark:border-white/10 dark:bg-white/5"
                >
                  <p className="text-sm text-muted-foreground">{termLabel(plan.termMonths)}</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-cfa-purple dark:text-white">
                    {rand(plan.price!)}
                  </p>
                  {plan.joiningFee ? (
                    <p className="mt-2 text-xs text-muted-foreground">+ {rand(plan.joiningFee)} joining fee</p>
                  ) : null}
                  <p
                    className={cn(
                      "mt-1 min-h-5 text-xs font-semibold text-green-700 dark:text-green-400",
                      !saving && "invisible",
                    )}
                  >
                    {saving ? `Save about ${saving}%` : "No saving"}
                  </p>
                  {showButtons && (
                    <Link
                      href={applyHref(plan.code)}
                      className={`mt-5 inline-flex min-h-10 items-center justify-center rounded-full border border-[#140a2e]/20 px-5 py-1.5 text-sm font-medium text-cfa-purple hover:bg-cfa-purple/5 dark:border-white/25 dark:text-white dark:hover:bg-white/10 ${FOCUS}`}
                    >
                      Apply
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-8 text-sm text-muted-foreground">Visiting fencers welcome — R120 drop-in</p>
    </div>
  );
}
