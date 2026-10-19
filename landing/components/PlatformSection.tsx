import Image from "next/image";
import { FadeIn } from "./FadeIn";
import type { getSiteContent } from "@/lib/keystatic/reader";

type PlatformSection = Awaited<ReturnType<typeof getSiteContent>>["platformSection"];

function Phone({
  image,
  label,
  elevated = false,
  className = "",
}: {
  image?: string | null;
  label?: string | null;
  elevated?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex w-full flex-col items-center ${elevated ? "relative z-10 sm:-translate-y-8" : ""} ${className}`}>
      <div className="relative aspect-[9/18] w-full overflow-hidden rounded-[2.8rem] border-8 border-[#2a2a2a] bg-black shadow-2xl">
        {image && <Image src={image} alt={label || ""} fill className="object-contain" sizes="480px" />}
      </div>
      {label && <span className="mt-5 whitespace-nowrap rounded-full bg-white/10 px-4 py-1.5 text-xsmall font-semibold">{label}</span>}
    </div>
  );
}

export function PlatformSection({ platformSection }: { platformSection: PlatformSection }) {
  const features = platformSection?.features || [];

  return (
    <section className="bg-black py-20 text-white sm:py-28">
      <div className="container-x text-center">
        <FadeIn>
          <p className="flex items-center justify-center gap-3 text-eyebrow uppercase text-white/70 sm:text-eyebrow-d">
            <span className="h-[2px] w-8 bg-lime" />
            {platformSection?.eyebrow || "Η ΠΛΑΤΦΟΡΜΑ"}
            <span className="h-[2px] w-8 bg-lime" />
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-h2l sm:text-h2l-d">
            {platformSection?.heading || "Όλο σου το πρόγραμμα, στο κινητό σου"}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-body text-white/60">{platformSection?.description}</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center justify-center gap-10 sm:flex-row sm:items-end sm:gap-3">
            <Phone
              image={platformSection?.phone1Image}
              label={platformSection?.phone1Label || "Πλάνο διατροφής"}
              className="max-w-[300px] sm:w-[30%]"
            />
            <Phone
              image={platformSection?.phone2Image}
              label={platformSection?.phone2Label || "Η προπόνησή μου"}
              elevated
              className="max-w-[320px] sm:w-[36%]"
            />
            <Phone
              image={platformSection?.phone3Image}
              label={platformSection?.phone3Label || "Πρόοδος & ρεκόρ"}
              className="max-w-[300px] sm:w-[30%]"
            />
          </div>
        </FadeIn>

        {features.length > 0 && (
          <FadeIn delay={0.15}>
            <div className="mt-20 grid gap-x-8 gap-y-10 text-left sm:grid-cols-2 lg:grid-cols-4">
              {features.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 h-6 w-1.5 shrink-0 -skew-x-12 bg-lime" />
                  <div>
                    <p className="text-h3 lg:whitespace-nowrap">{item.title}</p>
                    <p className="mt-0.5 text-xsmall text-white/60">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
