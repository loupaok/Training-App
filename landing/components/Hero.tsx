"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Star } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type HeroContent = Awaited<ReturnType<typeof getSiteContent>>["hero"];

export function Hero({ hero }: { hero: HeroContent }) {
  return (
    <section className="relative overflow-hidden bg-navy-900 pb-16 pt-36 text-white sm:pb-0 sm:pt-40">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] sm:block">
        {hero?.backgroundImage && (
          <Image src={hero.backgroundImage} alt="" fill priority className="object-cover" sizes="52vw" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/10 to-transparent" />
        <div className="absolute -right-10 bottom-0 top-0 w-20 -skew-x-[16deg] bg-lime/90" />
      </div>

      <div className="container-x relative grid gap-12 sm:grid-cols-2 sm:pb-20">
        <div className="relative z-10 sm:py-10">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/70"
          >
            <span className="h-[2px] w-8 bg-lime" />
            {hero?.badgeLabel || "CONSISTENCY CREATES RESULTS"}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
          >
            <span className="block">{hero?.headingLine1 || "Η ΣΥΝΕΠΕΙΑ"}</span>
            <span className="block">{hero?.headingLine2 || "ΦΕΡΝΕΙ"}</span>
            <span className="block text-lime">{hero?.headingHighlight || "ΑΠΟΤΕΛΕΣΜΑ."}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-md text-base leading-relaxed text-white/70"
          >
            {hero?.description ||
              "Ο δικός σου coach, ένα πλάνο προπόνησης και διατροφής μόνο για σένα, και απευθείας επικοινωνία μαζί του στο Discord."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <a
              href={hero?.ctaPrimaryHref || "#pricing"}
              className="group inline-flex items-center gap-2 rounded-full bg-lime px-7 py-4 text-sm font-bold text-navy-900 shadow-lg shadow-lime/30 transition-transform hover:-translate-y-0.5"
            >
              {hero?.ctaPrimaryLabel || "Γίνε μέλος του Team"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={hero?.ctaSecondaryHref || "#contact"}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-4 text-sm font-bold text-white transition-colors hover:border-white/60"
            >
              {hero?.ctaSecondaryLabel || "Κάνε το quiz 1 λεπτού"}
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center gap-6 text-sm font-semibold text-white/60"
          >
            <span>{hero?.memberCountLabel || "[X]+ μέλη στο Team"}</span>
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-lime" />
              {(hero?.ratingLabel || "★ [X]/5 από μέλη").replace("★", "").trim()}
            </span>
          </motion.div>
        </div>

        <div className="relative block aspect-[4/5] sm:hidden">
          {hero?.backgroundImage && (
            <Image src={hero.backgroundImage} alt="" fill className="object-cover" sizes="100vw" />
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative z-10 order-first sm:order-none sm:col-start-2 sm:row-start-1 sm:self-end sm:pb-16"
        >
          <div className="ml-auto max-w-[260px] rounded-2xl bg-white p-4 text-navy-900 shadow-2xl">
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy-400">{hero?.workoutDayLabel || "ΣΗΜΕΡΑ · ΗΜΕΡΑ 3"}</p>
            <p className="mt-1 text-base font-extrabold">{hero?.workoutTitle || "Lower Body — Deadlift"}</p>
            <p className="mt-0.5 text-xs text-navy-500">{hero?.workoutMeta || "5 ασκήσεις · 60 λεπτά"}</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
              <div className="h-full w-2/3 rounded-full bg-navy-900" />
            </div>
          </div>
          <div className="ml-auto mt-3 flex max-w-[260px] items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-xs font-bold text-navy-900 shadow-lg">
            <Star className="h-3.5 w-3.5" filled />
            {hero?.workoutPoints || "+[X] πόντοι · Συνδρομή Οκτωβρίου"}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
