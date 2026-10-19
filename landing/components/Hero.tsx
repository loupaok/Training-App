"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type HeroContent = Awaited<ReturnType<typeof getSiteContent>>["hero"];

export function Hero({ hero }: { hero: HeroContent }) {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-lime/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-navy/10 blur-3xl dark:bg-lime/10" />
      </div>

      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-lime/40 bg-lime/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-navy-800 dark:text-lime"
          >
            {hero?.eyebrow || "SP Team Personal Coaching"}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            {hero?.heading || "Το σώμα και το μυαλό σου, ανεβασμένα σε άλλο επίπεδο."}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-navy-600 dark:text-white/70"
          >
            {hero?.subheading || "Προσωπικά πλάνα προπόνησης και διατροφής, σχεδιασμένα γύρω από εσένα."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <a
              href={hero?.ctaHref || "#contact"}
              className="group inline-flex items-center gap-2 rounded-full bg-lime px-7 py-4 text-sm font-bold text-navy-900 shadow-lg shadow-lime/30 transition-transform hover:-translate-y-0.5"
            >
              {hero?.ctaLabel || "Κλείσε Δωρεάν Ραντεβού"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#services"
              className="inline-flex items-center gap-2 rounded-full border border-navy-200 px-7 py-4 text-sm font-bold text-navy-800 transition-colors hover:border-navy-400 dark:border-white/20 dark:text-white dark:hover:border-white/50"
            >
              Δες τα πακέτα
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] bg-navy-100 shadow-2xl dark:bg-white/5"
        >
          {hero?.image ? (
            <Image src={hero.image} alt={hero?.heading || "SP Team"} fill className="object-cover" priority />
          ) : (
            <div className="grid h-full place-items-center text-navy-300 dark:text-white/20">
              <span className="text-sm font-semibold">Hero image</span>
            </div>
          )}
          <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur dark:bg-navy-900/90">
            <p className="text-xs font-bold uppercase tracking-wide text-lime-700 dark:text-lime">Personal Coaching</p>
            <p className="mt-1 text-sm font-semibold text-navy-900 dark:text-white">1-on-1 πρόγραμμα, φτιαγμένο για εσένα</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
