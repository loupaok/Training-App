"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { FadeIn } from "./FadeIn";
import type { getSiteContent } from "@/lib/keystatic/reader";

type PlatformSection = Awaited<ReturnType<typeof getSiteContent>>["platformSection"];

function Phone({ image, label, elevated = false, className = "" }: { image?: string | null; label?: string | null; elevated?: boolean; className?: string }) {
  return (
    <div className={`flex w-full flex-col items-center ${elevated ? "relative z-10 sm:-translate-y-8" : ""} ${className}`}>
      <div className="relative aspect-[9/18] w-full overflow-hidden rounded-[2.8rem] border-8 border-[#2a2a2a] bg-black shadow-2xl">
        {image && <Image src={image} alt={label || ""} fill className="object-contain" sizes="480px" />}
      </div>
      {label && <span className="mt-5 hidden whitespace-nowrap rounded-full bg-white/10 px-4 py-1.5 text-xsmall font-semibold sm:inline-flex">{label}</span>}
    </div>
  );
}

export function PlatformSection({ platformSection }: { platformSection: PlatformSection }) {
  const features = platformSection?.features || [];
  const phoneLabels = [
    platformSection?.phone1Label || "Πλάνο διατροφής",
    platformSection?.phone2Label || "Η προπόνησή μου",
    platformSection?.phone3Label || "Πρόοδος & ρεκόρ",
  ];
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activePhone, setActivePhone] = useState(0);

  const updateActivePhone = () => {
    const slider = sliderRef.current;
    if (!slider) return;
    const slides = Array.from(slider.children) as HTMLElement[];
    const sliderCenter = slider.scrollLeft + slider.clientWidth / 2;
    const closestIndex = slides.reduce((closest, slide, index) => {
      const currentDistance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - sliderCenter);
      const closestDistance = Math.abs(slides[closest].offsetLeft + slides[closest].offsetWidth / 2 - sliderCenter);
      return currentDistance < closestDistance ? index : closest;
    }, 0);
    setActivePhone(closestIndex);
  };

  const goToPhone = (index: number) => {
    const slider = sliderRef.current;
    const slide = slider?.children.item(index) as HTMLElement | null;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <section id="platform" className="bg-black py-20 text-white sm:py-28">
      <div className="container-x overflow-hidden text-center">
        <FadeIn>
          <p className="flex items-center justify-center gap-3 text-eyebrow uppercase text-white/70 sm:text-eyebrow-d">
            <span className="h-[2px] w-8 bg-lime" />
            {platformSection?.eyebrow || "Η ΠΛΑΤΦΟΡΜΑ"}
            <span className="h-[2px] w-8 bg-lime" />
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-h2l sm:text-h2l-d">{platformSection?.heading || "Όλο σου το πρόγραμμα, στο κινητό σου"}</h2>
          <p className="mx-auto mt-4 max-w-xl text-body text-white/60">{platformSection?.description}</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div ref={sliderRef} onScroll={updateActivePhone} className="-mx-5 mt-10 flex snap-x snap-mandatory items-end gap-4 overflow-x-auto pb-3 pl-[15vw] pr-5 [scrollbar-width:none] sm:mx-auto sm:mt-16 sm:max-w-3xl sm:justify-center sm:gap-3 sm:overflow-visible sm:px-0">
            <Phone image={platformSection?.phone1Image} label={phoneLabels[0]} className="w-[72vw] shrink-0 snap-center sm:w-[30%] sm:shrink" />
            <Phone image={platformSection?.phone2Image} label={phoneLabels[1]} elevated className="w-[72vw] shrink-0 snap-center sm:w-[36%] sm:shrink" />
            <Phone image={platformSection?.phone3Image} label={phoneLabels[2]} className="w-[72vw] shrink-0 snap-center sm:w-[30%] sm:shrink" />
          </div>
          <div className="mt-2 flex flex-col items-center gap-3 sm:hidden">
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">{phoneLabels[activePhone]}</span>
            <div className="flex items-center gap-2" aria-label={`Οθόνη ${activePhone + 1} από ${phoneLabels.length}`}>
              {phoneLabels.map((label, index) => (
                <button key={label} type="button" aria-label={`Εμφάνιση: ${label}`} aria-current={activePhone === index} onClick={() => goToPhone(index)} className={`h-2.5 rounded-full transition-all ${activePhone === index ? "w-6 bg-lime" : "w-2.5 bg-white/30"}`} />
              ))}
            </div>
          </div>
        </FadeIn>

        {features.length > 0 && (
          <FadeIn delay={0.15}>
            <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-7 text-left sm:mt-20 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-4">
              {features.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 h-5 w-1 shrink-0 -skew-x-12 bg-lime sm:h-6 sm:w-1.5" />
                  <div>
                    <p className="text-sm font-bold sm:text-h3 lg:whitespace-nowrap">{item.title}</p>
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
