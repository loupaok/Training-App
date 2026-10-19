import Image from "next/image";
import type { getSiteContent } from "@/lib/keystatic/reader";

type HeroContent = Awaited<ReturnType<typeof getSiteContent>>["hero"];

export function FinalCta({ hero }: { hero: HeroContent }) {
  return <section className="bg-[#f8f8f5] px-4 sm:px-6 lg:px-8"><div className="relative mx-auto flex min-h-[520px] max-w-[1440px] items-center justify-center overflow-hidden rounded-t-[32px] text-center text-white"><>{hero?.backgroundImage && <Image src={hero.backgroundImage} alt="" fill className="object-cover object-center" sizes="100vw" />}</><div className="absolute inset-0 bg-black/65" /><div className="relative px-5"><p className="text-xs font-bold uppercase tracking-[.25em] text-lime">SP Team</p><h2 className="mt-5 text-5xl font-black italic uppercase leading-[.86] tracking-tight sm:text-7xl">Η καλύτερη εκδοχή σου<br />ξεκινά σήμερα.</h2><a href={hero?.ctaPrimaryHref || "#pricing"} className="mt-8 inline-flex items-center rounded-full bg-lime px-7 py-4 text-sm font-extrabold text-navy-900">{hero?.ctaPrimaryLabel || "Γίνε μέλος του Team"} <span className="ml-2">→</span></a></div></div></section>;
}
