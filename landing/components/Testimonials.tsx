import Image from "next/image";
import { Star } from "./icons";
import { FadeIn } from "./FadeIn";
import type { getSiteContent, getTestimonials } from "@/lib/keystatic/reader";

type TestimonialsIntro = Awaited<ReturnType<typeof getSiteContent>>["testimonialsIntro"];
type Testimonials = Awaited<ReturnType<typeof getTestimonials>>;

export function Testimonials({ intro, testimonials }: { intro: TestimonialsIntro; testimonials: Testimonials }) {
  return (
    <section id="testimonials" className="py-24 sm:py-32">
      <div className="container-x">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-lime-700 dark:text-lime">{intro?.eyebrow || "Αποτελέσματα"}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{intro?.heading || "Τι λένε οι πελάτες μας"}</h2>
        </FadeIn>

        {testimonials.length ? (
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((item, index) => {
              const displayName = item.name || "";
              return (
              <FadeIn key={item.slug} delay={index * 0.08}>
                <div className="flex h-full flex-col rounded-3xl border border-navy-100 bg-white p-7 dark:border-white/10 dark:bg-white/5">
                  <div className="flex gap-1 text-lime-500">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="h-4 w-4" filled={i < (item.rating ?? 5)} />
                    ))}
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-navy-700 dark:text-white/80">&ldquo;{item.quote}&rdquo;</p>
                  <div className="mt-6 flex items-center gap-3">
                    {item.photo ? (
                      <Image src={item.photo} alt={displayName} width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-navy-100 text-sm font-bold text-navy-600 dark:bg-white/10 dark:text-white/70">
                        {displayName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-extrabold">{displayName}</p>
                      {item.role && <p className="text-xs text-navy-500 dark:text-white/50">{item.role}</p>}
                    </div>
                  </div>
                </div>
              </FadeIn>
              );
            })}
          </div>
        ) : (
          <p className="mt-16 text-center text-sm text-navy-400">Οι μαρτυρίες πελατών θα εμφανιστούν εδώ μόλις προστεθούν από το /keystatic.</p>
        )}
      </div>
    </section>
  );
}
