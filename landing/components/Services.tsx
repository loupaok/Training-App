import { CheckCircle, X } from "./icons";
import { FadeIn } from "./FadeIn";
import type { getSiteContent } from "@/lib/keystatic/reader";
import { formatPrice, type PricingPlan } from "@/lib/pricing";

type ServicesIntro = Awaited<ReturnType<typeof getSiteContent>>["servicesIntro"];

export function Services({ intro, plans }: { intro: ServicesIntro; plans: PricingPlan[] }) {
  return (
    <section id="pricing" className="bg-navy-50 py-20 dark:bg-navy-950 sm:py-28">
      <div className="container-x">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-lime-700 dark:text-lime">{intro?.eyebrow || "Τιμές"}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {intro?.heading || "Απλές τιμές, χωρίς δέσμευση"}
          </h2>
          {intro?.subheading && <p className="mt-4 text-navy-600 dark:text-white/70">{intro.subheading}</p>}
        </FadeIn>

        {plans.length ? (
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan, index) => (
              <FadeIn key={plan.slug} delay={index * 0.08}>
                <div
                  className={`flex h-full flex-col rounded-2xl p-8 transition-transform hover:-translate-y-1 ${
                    plan.isPopular ? "bg-navy-950 text-white shadow-2xl" : "bg-white dark:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-lg font-extrabold ${plan.isPopular ? "text-white" : "text-navy-900 dark:text-white"}`}>{plan.name}</h3>
                    {plan.badge && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-lime px-3 py-1 text-xs font-bold text-navy-900">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className={`mt-4 flex items-baseline gap-1 ${plan.isPopular ? "text-white" : "text-navy-900 dark:text-white"}`}>
                    <span className="text-4xl font-extrabold">{formatPrice(plan)}</span>
                    {plan.period && <span className="text-sm font-semibold opacity-60">/{plan.period}</span>}
                  </p>
                  {plan.description && (
                    <p className={`mt-3 text-sm ${plan.isPopular ? "text-white/70" : "text-navy-600 dark:text-white/70"}`}>{plan.description}</p>
                  )}
                  {plan.features?.length ? (
                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2.5 text-sm ${
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
                    href="#contact"
                    className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition-colors ${
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
          <p className="mt-16 text-center text-sm text-navy-400">
            Τα πακέτα δεν είναι διαθέσιμα αυτή τη στιγμή. Βεβαιώσου ότι η κύρια εφαρμογή (backend) τρέχει.
          </p>
        )}
      </div>
    </section>
  );
}
