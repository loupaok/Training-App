import Image from "next/image";
import { CheckCircle, X } from "./icons";
import { FadeIn } from "./FadeIn";
import type { getSiteContent, getPricingPlans } from "@/lib/keystatic/reader";
import { formatPrice } from "@/lib/pricing";

type ServicesIntro = Awaited<ReturnType<typeof getSiteContent>>["servicesIntro"];
type PricingPlans = Awaited<ReturnType<typeof getPricingPlans>>;

export function Services({ intro, plans }: { intro: ServicesIntro; plans: PricingPlans }) {
  const popularPlan = plans.find((plan) => plan.isPopular);
  const standardPlans = plans.filter((plan) => !plan.isPopular);
  const desktopPlans = popularPlan && standardPlans.length
    ? [standardPlans[0], popularPlan, ...standardPlans.slice(1)]
    : plans;

  return (
    <section id="pricing" className="bg-[#f2f2f0] py-12 dark:bg-navy-950 sm:py-28">
      <div className="container-x">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-eyebrow uppercase text-lime-700 dark:text-lime sm:text-eyebrow-d">{intro?.eyebrow || "Τιμές"}</p>
          <h2 className="mt-3 text-h2l sm:text-h2l-d">
            {intro?.heading || "Απλές τιμές, χωρίς δέσμευση"}
          </h2>
        </FadeIn>

        {plans.length ? (
          <div className="mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {desktopPlans.map((plan, index) => (
              <FadeIn key={plan.slug} delay={index * 0.08} className={plan.isPopular ? "order-first lg:order-none" : undefined}>
                <div
                    className={`flex h-full flex-col rounded-2xl p-6 transition-transform hover:-translate-y-1 sm:p-8 ${
                    plan.isPopular ? "bg-navy-950 text-white shadow-2xl" : "bg-white dark:bg-white/5"
                  }`}
                >
                  {plan.photo && (
                    <div className="relative mb-5 aspect-[4/3] w-full overflow-hidden rounded-xl">
                      <Image src={plan.photo} alt={plan.name || ""} fill className="object-cover" sizes="300px" />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-h3 ${plan.isPopular ? "text-white" : "text-navy-900 dark:text-white"}`}>{plan.name}</h3>
                    {plan.badge && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-lime px-3 py-1 text-label text-navy-900">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className={`mt-4 flex items-baseline gap-1 ${plan.isPopular ? "text-white" : "text-navy-900 dark:text-white"}`}>
                    <span className="text-price sm:text-price-d">{formatPrice(plan)}</span>
                    {plan.period && <span className="text-xsmall font-semibold opacity-60">/{plan.period}</span>}
                  </p>
                  {plan.description && (
                    <p className={`mt-3 text-xsmall ${plan.isPopular ? "text-white/70" : "text-navy-600 dark:text-white/70"}`}>{plan.description}</p>
                  )}
                  {plan.features?.length ? (
                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2.5 text-xsmall ${
                            feature.included
                              ? plan.isPopular
                                ? "text-white/90"
                                : "text-navy-700 dark:text-white/80"
                              : plan.isPopular
                                ? "text-white/30 line-through"
                                : "text-navy-300 line-through dark:text-white/30"
                          }`}
                        >
                          {feature.included ? (
                            <CheckCircle className={`mt-0.5 h-4 w-4 shrink-0 ${plan.isPopular ? "text-lime" : "text-lime-600"}`} />
                          ) : (
                            <X className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          {feature.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <a
                    href="#pricing"
                    className={`btn-primary mt-8 transition-colors ${
                      plan.isPopular
                        ? "bg-lime text-navy-900 hover:bg-lime-400"
                        : "bg-navy-900 text-white hover:bg-navy-700 dark:bg-white dark:text-navy-900"
                    }`}
                  >
                    Ξεκίνα τώρα
                  </a>
                </div>
              </FadeIn>
            ))}
          </div>
        ) : (
          <p className="mt-16 text-center text-body text-navy-400">
            Τα πακέτα δεν είναι διαθέσιμα αυτή τη στιγμή. Πρόσθεσέ τα από το /keystatic.
          </p>
        )}
      </div>
    </section>
  );
}
