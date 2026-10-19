import Image from "next/image";
import { FadeIn } from "./FadeIn";
import { Dumbbell } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type ExpertsSection = Awaited<ReturnType<typeof getSiteContent>>["expertsSection"];

export function ExpertsSection({ expertsSection }: { expertsSection: ExpertsSection }) {
  const gallery = expertsSection?.gallery || [];
  const tags = expertsSection?.tags || [];

  return (
    <section className="bg-navy-900 py-20 text-white sm:py-28">
      <div className="container-x grid gap-16 lg:grid-cols-2 lg:items-start">
        <FadeIn>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {expertsSection?.heading || "Φτιαγμένο από ειδικούς"}
          </h2>
          <p className="mt-4 max-w-md text-white/60">{expertsSection?.description}</p>

          {gallery.length > 0 && (
            <div className="mt-8 grid grid-cols-4 gap-2 sm:gap-3">
              {gallery.filter((src): src is string => Boolean(src)).map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-white/5">
                  <Image src={src} alt="" fill className="object-cover" sizes="140px" />
                </div>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span key={i} className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </FadeIn>

        <FadeIn delay={0.1}>
          <h3 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {expertsSection?.discordHeading || "Ποτέ δεν προπονείσαι μόνος"}
          </h3>
          <p className="mt-4 max-w-md text-white/60">{expertsSection?.discordDescription}</p>

          <div className="relative mt-8 aspect-[4/3] w-full max-w-lg">
            {expertsSection?.discordBackImage && (
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <Image src={expertsSection.discordBackImage} alt="" fill className="object-cover" sizes="500px" />
              </div>
            )}
            {expertsSection?.discordFrontImage && (
              <div className="absolute bottom-0 left-0 aspect-[3/4] w-[55%] overflow-hidden rounded-2xl border-4 border-navy-900 shadow-2xl">
                <Image src={expertsSection.discordFrontImage} alt="" fill className="object-cover" sizes="300px" />
              </div>
            )}
            <div className="absolute bottom-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-navy-900">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div className="absolute bottom-4 right-0 flex items-center gap-2 rounded-xl bg-navy-800/95 px-4 py-3 text-xs font-bold shadow-xl backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-lime" />
              {expertsSection?.coachChatMessage || "Coach: «Τέλειο set! Συνέχισε έτσι»"}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
