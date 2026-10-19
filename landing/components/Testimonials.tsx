import Image from "next/image";
import { Play } from "./icons";
import { FadeIn } from "./FadeIn";
import type { getSiteContent, getTestimonials } from "@/lib/keystatic/reader";

type TestimonialsIntro = Awaited<ReturnType<typeof getSiteContent>>["testimonialsIntro"];
type Testimonials = Awaited<ReturnType<typeof getTestimonials>>;

export function Testimonials({ intro, testimonials }: { intro: TestimonialsIntro; testimonials: Testimonials }) {
  return (
    <section id="testimonials" className="bg-white py-20 dark:bg-navy-900 sm:py-28">
      <div className="container-x">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{intro?.heading || "Τα μέλη μας βλέπουν αποτελέσματα"}</h2>
          <div className="mt-4 flex items-center justify-center gap-3 text-sm text-navy-500 dark:text-white/50">
            <span>{intro?.ratingLabel || "★ [X]/5 από μέλη"}</span>
            <span className="h-1 w-1 rounded-full bg-navy-300 dark:bg-white/30" />
            <span>{intro?.statLabel}</span>
          </div>
        </FadeIn>

        {testimonials.length ? (
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((item, index) => {
              const displayName = item.name || "";
              return (
                <FadeIn key={item.slug} delay={index * 0.08}>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-navy-100 dark:bg-white/5">
                    {item.photo && <Image src={item.photo} alt={displayName} fill className="object-cover" sizes="360px" />}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <p className="text-sm font-extrabold text-white">{displayName}</p>
                      <p className="text-xs text-white/70">{item.role}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Αναπαραγωγή"
                      className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-navy-900"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-navy-600 dark:text-white/70">«{item.quote}»</p>
                </FadeIn>
              );
            })}
          </div>
        ) : (
          <p className="mt-14 text-center text-sm text-navy-400">Οι μαρτυρίες πελατών θα εμφανιστούν εδώ μόλις προστεθούν από το /keystatic.</p>
        )}

        <div className="mt-10 text-center">
          <a href={intro?.ctaHref || "#contact"} className="inline-flex rounded-full border border-navy-200 px-6 py-3 text-sm font-bold dark:border-white/20">
            {intro?.ctaLabel || "Κάνε το quiz 1 λεπτού"}
          </a>
        </div>
      </div>
    </section>
  );
}
