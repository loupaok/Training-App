import Image from "next/image";
import { FadeIn } from "./FadeIn";
import { Play, Instagram, Youtube } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type CoachProfile = Awaited<ReturnType<typeof getSiteContent>>["coachProfile"];

export function CoachProfile({ coachProfile }: { coachProfile: CoachProfile }) {
  const stats = coachProfile?.stats || [];
  const achievements = coachProfile?.achievements || [];

  return (
    <section id="coach" className="relative overflow-hidden bg-navy-950 py-20 text-white sm:py-28">
      <div className="container-x grid gap-14 lg:grid-cols-2 lg:items-start">
        <FadeIn>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl">
            {coachProfile?.photo && <Image src={coachProfile.photo} alt={coachProfile?.name || "Coach"} fill className="object-cover" sizes="400px" />}
            <div className="absolute left-4 top-4 rounded-xl bg-white/95 px-4 py-2.5 text-navy-900 shadow-lg">
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-400">{coachProfile?.competitorBadgeLabel || "ΑΓΩΝΙΣΤΗΣ"}</p>
              <p className="text-sm font-extrabold">{coachProfile?.competitorOrg || "NPC Worldwide"}</p>
              <p className="text-xs text-navy-500">{coachProfile?.competitorCategory || "Bodybuilding · Heavyweight"}</p>
            </div>
            <button
              type="button"
              className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/95 py-2 pl-2 pr-4 text-navy-900 shadow-lg"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-lime">
                <Play className="h-3.5 w-3.5" />
              </span>
              <span className="text-left">
                <span className="block text-xs font-extrabold leading-tight">{coachProfile?.videoLabel || "Δες το μήνυμά μου"}</span>
                <span className="block text-[10px] text-navy-500">{coachProfile?.videoDuration || "Βίντεο γνωριμίας · 1:20"}</span>
              </span>
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            <span className="h-[2px] w-8 bg-lime" />
            {coachProfile?.eyebrow || "Ο COACH ΣΟΥ"}
          </p>
          <h2 className="mt-4 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            {coachProfile?.name || "ΠΑΝΤΕΛΗΣ ΣΤΑΥΡΟΥΛΑΚΗΣ"}
            <span className="text-lime">.</span>
          </h2>
          <p className="mt-4 text-sm font-semibold text-white/70">{coachProfile?.subtitle}</p>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60">{coachProfile?.bio}</p>

          {stats.length > 0 && (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((stat, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-4">
                  <p className="text-xl font-black text-lime">{stat.value}</p>
                  <p className="mt-1 text-xs text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {achievements.length > 0 && (
            <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
              {achievements.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="font-extrabold text-lime">{a.year}</span>
                  <span className="flex-1 font-semibold">{a.title}</span>
                  <span className="text-white/50">{a.result}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#contact" className="rounded-full bg-lime px-6 py-3 text-sm font-bold text-navy-900">
              {coachProfile?.ctaLabel || "Δούλεψε μαζί μου"}
            </a>
            {coachProfile?.instagram && (
              <a href={coachProfile.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold">
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            )}
            {coachProfile?.youtube && (
              <a href={coachProfile.youtube} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold">
                <Youtube className="h-4 w-4" /> YouTube
              </a>
            )}
          </div>
        </FadeIn>
      </div>

      {coachProfile?.quote && (
        <FadeIn delay={0.1}>
          <div className="container-x mt-16 flex flex-col gap-6 border-t border-white/10 pt-12 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-2xl text-2xl font-semibold italic leading-snug sm:text-3xl">
              «{coachProfile.quote.replace(/^«|»$/g, "")}»
            </p>
            <p className="text-sm text-white/50">— {coachProfile?.quoteAuthor}</p>
          </div>
        </FadeIn>
      )}
    </section>
  );
}
