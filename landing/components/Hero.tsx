"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Star } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type HeroContent = Awaited<ReturnType<typeof getSiteContent>>["hero"];

function WorkoutCard({ hero, className = "" }: { hero: HeroContent; className?: string }) {
  return (
    <div className={className}>
      <div className="w-fit max-w-[calc(100%-1rem)] rounded-[1.6rem] bg-white px-5 py-4 text-navy-900 shadow-2xl sm:ml-auto sm:max-w-[310px] sm:rounded-2xl sm:p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-navy-500 sm:text-label">
          {hero?.workoutDayLabel || "ΣΗΜΕΡΑ · ΗΜΕΡΑ 3"}
        </p>
        <p className="mt-1 text-[23px] font-extrabold leading-tight sm:text-h3">
          {hero?.workoutTitle || "Lower Body — Deadlift"}
        </p>
      </div>
      <div className="ml-auto mt-4 flex w-fit max-w-[17rem] items-center gap-2 rounded-full bg-lime px-4 py-2.5 text-xs font-extrabold text-navy-900 shadow-xl sm:mt-5 sm:max-w-[310px] sm:px-5 sm:py-3 sm:text-sm">
        <Star className="h-5 w-5 shrink-0" filled />
        <span className="min-w-0 truncate">{hero?.workoutPoints || "+[X] πόντοι · Συνδρομή"}</span>
      </div>
    </div>
  );
}

export function Hero({ hero }: { hero: HeroContent }) {
  return (
    <section className="relative overflow-hidden bg-[#0b0b0b] text-white">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] sm:block">
        {hero?.backgroundImage && <Image src={hero.backgroundImage} alt={hero.backgroundImageAlt || ""} fill priority className="object-cover" sizes="52vw" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b] via-[#0b0b0b]/10 to-transparent" />
        <div className="absolute -right-10 bottom-0 top-0 w-20 -skew-x-[16deg] bg-lime/90" />
      </div>

      <span aria-hidden className="pointer-events-none absolute right-10 top-[44px] z-10 h-[460px] w-[22px] -skew-x-[18deg] bg-lime sm:hidden" />

      <div className="container-x relative grid gap-0 pb-0 pt-16 sm:grid-cols-2 sm:gap-12 sm:pb-20 sm:pt-40">
        <div className="relative z-10 order-2 -mt-28 bg-transparent pb-10 pt-8 sm:order-none sm:mt-0 sm:py-10">
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.34em] text-white/70 sm:text-eyebrow-d">
            <span className="h-[2px] w-10 bg-lime" />
            {hero?.badgeLabel || "CONSISTENCY CREATES RESULTS"}
          </motion.p>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="mt-5 text-[50px] font-extrabold italic uppercase leading-[.88] tracking-[-1.8px] sm:mt-6 sm:text-h1-d">
            <span className="block">{hero?.headingLine1 || "Η ΣΥΝΕΠΕΙΑ"}</span>
            <span className="block">{hero?.headingLine2 || "ΦΕΡΝΕΙ"}</span>
            <span className="block text-lime">{hero?.headingHighlight || "ΑΠΟΤΕΛΕΣΜΑ."}</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-7 max-w-md text-[18px] leading-[1.58] text-white/70 sm:mt-6 sm:text-lead-d">
            {hero?.description || "Ο δικός σου coach, ένα πλάνο προπόνησης και διατροφής μόνο για σένα."}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-9 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <a href={hero?.ctaPrimaryHref || "#pricing"} className="btn-primary group h-16 w-full bg-lime text-lg text-navy-900 shadow-lg shadow-lime/30 transition-transform hover:-translate-y-0.5 sm:h-[60px] sm:w-auto sm:text-base">
              {hero?.ctaPrimaryLabel || "Γίνε μέλος του Team"}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a href={hero?.ctaSecondaryHref || "#pricing"} className="btn-secondary h-16 w-full border border-white/25 text-lg text-white transition-colors hover:border-white/60 sm:h-[60px] sm:w-auto sm:text-[15px]">
              {hero?.ctaSecondaryLabel || "Κάνε το quiz 1 λεπτού"}
            </a>
          </motion.div>

          {hero?.showMemberStats !== false && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }} className="mt-8 hidden flex-wrap items-center gap-6 text-body font-semibold text-white/60 sm:flex">
            <span>{hero?.memberCountLabel || "[X]+ μέλη στο Team"}</span>
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4 text-lime" />{(hero?.ratingLabel || "[X]/5 από μέλη").replace("★", "").trim()}</span>
          </motion.div>}
        </div>

        <div className="relative order-1 -mx-5 h-[23rem] overflow-hidden bg-black sm:hidden">
          {hero?.backgroundImage && <Image src={hero.backgroundImage} alt={hero.backgroundImageAlt || ""} fill priority className="object-cover object-center" sizes="100vw" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
          {hero?.showWorkoutCard !== false && <WorkoutCard hero={hero} className="absolute inset-x-5 top-10 z-20" />}
        </div>

        {hero?.showWorkoutCard !== false && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="relative z-10 hidden sm:col-start-2 sm:row-start-1 sm:flex sm:h-full sm:flex-col sm:justify-end sm:pb-16">
          <WorkoutCard hero={hero} />
        </motion.div>}
      </div>
    </section>
  );
}
