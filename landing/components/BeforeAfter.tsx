import Image from "next/image";
import { FadeIn } from "./FadeIn";
import type { getSiteContent, getTestimonials } from "@/lib/keystatic/reader";

type BeforeAfterIntro = Awaited<ReturnType<typeof getSiteContent>>["testimonialsIntro"];
type Transformations = Awaited<ReturnType<typeof getTestimonials>>;

export function BeforeAfter({ intro, transformations }: { intro: BeforeAfterIntro; transformations: Transformations }) {
  return (
    <section id="before-after" className="bg-white py-20 dark:bg-navy-900 sm:py-28">
      <div className="container-x">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="flex items-center justify-center gap-3 text-eyebrow uppercase text-navy-500 dark:text-white/60 sm:text-eyebrow-d">
            <span className="h-[2px] w-8 bg-lime" />
            {intro?.eyebrow || "ΠΡΙΝ & ΜΕΤΑ"}
          </p>
          <h2 className="mt-4 text-h2l sm:text-h2l-d">{intro?.heading || "Πραγματικοί άνθρωποι, πραγματικά αποτελέσματα"}</h2>
          <div className="mt-4 flex items-center justify-center gap-3 text-body text-navy-500 dark:text-white/50">
            <span>{intro?.ratingLabel || "★ [X]/5 από μέλη"}</span>
            <span className="h-1 w-1 rounded-full bg-navy-300 dark:bg-white/30" />
            <span>{intro?.statLabel}</span>
          </div>
        </FadeIn>

        {transformations.length ? (
          <div className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] md:mx-0 md:mt-14 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
            {transformations.map((item, index) => {
              const displayName = item.name || "";
              return (
                <FadeIn key={item.slug} delay={index * 0.08}>
                <div className="flex h-full w-[78vw] flex-col snap-center rounded-3xl border border-navy-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 md:w-auto md:p-5">
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-navy-100 dark:bg-white/5">
                      {item.photo && <Image src={item.photo} alt={displayName} fill className="object-cover" sizes="360px" />}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <p className="text-h3">{item.statValue}</p>
                      <span className="rounded-full bg-navy-100 px-3 py-1 text-xsmall font-semibold text-navy-600 dark:bg-white/10 dark:text-white/70">
                        {item.weeksLabel}
                      </span>
                    </div>

                    <p className="mt-3 text-body leading-relaxed text-navy-600 dark:text-white/70">«{item.quote}»</p>

                    <p className="mt-4 text-xsmall font-semibold">{displayName}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        ) : (
          <p className="mt-14 text-center text-body text-navy-400">Οι μεταμορφώσεις θα εμφανιστούν εδώ μόλις προστεθούν από το /keystatic.</p>
        )}

        <div className="mt-10 text-center">
          <a href={intro?.ctaHref || "#pricing"} className="btn-secondary border border-navy-200 dark:border-white/20">
            {intro?.ctaLabel || "Γίνε η επόμενη μεταμόρφωση"}
          </a>
        </div>
      </div>
    </section>
  );
}
