import Image from "next/image";
import type { getSiteContent } from "@/lib/keystatic/reader";

type FinalCta = Awaited<ReturnType<typeof getSiteContent>>["finalCta"];

export function FinalCta({ finalCta }: { finalCta: FinalCta }) {
  const heading = finalCta?.heading || "Η καλύτερη εκδοχή σου\nξεκινά σήμερα.";

  return (
    <section className="bg-[#f8f8f5] px-4 sm:px-6 lg:px-8">
      <div className="relative mx-auto flex min-h-[520px] max-w-[1440px] items-center justify-center overflow-hidden rounded-t-[32px] text-center text-white">
        {finalCta?.bannerImage && (
          <Image src={finalCta.bannerImage} alt="" fill className="object-cover object-center" sizes="100vw" />
        )}
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative px-5">
          <p className="text-eyebrow uppercase text-lime sm:text-eyebrow-d">{finalCta?.eyebrow || "SP Team"}</p>
          <h2 className="mt-5 text-h2b italic uppercase sm:text-h2b-d">
            {heading.split("\n").map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
          <a href={finalCta?.ctaHref || "#pricing"} className="btn-primary mt-8 bg-lime text-navy-900">
            {finalCta?.ctaLabel || "Γίνε μέλος του Team"} <span className="ml-2">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
