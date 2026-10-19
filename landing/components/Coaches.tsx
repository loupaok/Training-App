import Image from "next/image";
import { Instagram } from "./icons";
import { FadeIn } from "./FadeIn";
import type { getSiteContent, getCoaches } from "@/lib/keystatic/reader";

type CoachesIntro = Awaited<ReturnType<typeof getSiteContent>>["coachesIntro"];
type Coaches = Awaited<ReturnType<typeof getCoaches>>;

export function Coaches({ intro, coaches }: { intro: CoachesIntro; coaches: Coaches }) {
  return (
    <section id="coaches" className="bg-navy-50/60 py-24 dark:bg-white/[0.02] sm:py-32">
      <div className="container-x">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-lime-700 dark:text-lime">{intro?.eyebrow || "Η Ομάδα"}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{intro?.heading || "Γνώρισε τους coaches μας"}</h2>
          {intro?.subheading && <p className="mt-4 text-navy-600 dark:text-white/70">{intro.subheading}</p>}
        </FadeIn>

        {coaches.length ? (
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((coach, index) => {
              const displayName = coach.name || "";
              return (
              <FadeIn key={coach.slug} delay={index * 0.08}>
                <div className="group overflow-hidden rounded-3xl bg-white shadow-sm transition-shadow hover:shadow-xl dark:bg-white/5">
                  <div className="relative aspect-[4/5] overflow-hidden bg-navy-100 dark:bg-white/10">
                    {coach.photo ? (
                      <Image
                        src={coach.photo}
                        alt={displayName}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-navy-300 dark:text-white/20">
                        <span className="text-sm font-semibold">{displayName}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-extrabold">{displayName}</h3>
                      {coach.instagram && (
                        <a
                          href={coach.instagram}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Instagram ${displayName}`}
                          className="text-navy-400 transition-colors hover:text-lime-600 dark:text-white/40 dark:hover:text-lime"
                        >
                          <Instagram className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-bold text-lime-700 dark:text-lime">{coach.role}</p>
                    {coach.bio && <p className="mt-3 text-sm leading-relaxed text-navy-600 dark:text-white/70">{coach.bio}</p>}
                  </div>
                </div>
              </FadeIn>
              );
            })}
          </div>
        ) : (
          <p className="mt-16 text-center text-sm text-navy-400">Τα μέλη της ομάδας θα εμφανιστούν εδώ μόλις προστεθούν από το /keystatic.</p>
        )}
      </div>
    </section>
  );
}
