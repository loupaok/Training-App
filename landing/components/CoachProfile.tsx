import Image from "next/image";
import { FadeIn } from "./FadeIn";
import { Play, Instagram, Youtube } from "./icons";
import { VideoPopupButton } from "./VideoPopupButton";
import type { getSiteContent } from "@/lib/keystatic/reader";

type CoachProfile = Awaited<ReturnType<typeof getSiteContent>>["coachProfile"];
type Settings = Awaited<ReturnType<typeof getSiteContent>>["settings"];

export function CoachProfile({ coachProfile, settings }: { coachProfile: CoachProfile; settings?: Settings }) {
  const stats = coachProfile?.stats || [];
  const achievements = coachProfile?.achievements || [];

  return (
    <section id="coach" className="relative overflow-hidden bg-[#151515] py-20 text-white sm:py-28">
      <p
        aria-hidden
        className="pointer-events-none absolute -top-4 left-0 select-none whitespace-nowrap text-[120px] font-black italic uppercase leading-none tracking-tighter text-[#1a1818] sm:text-[200px]"
      >
        SP TEAM COACH
      </p>
      <div className="container-x relative z-10 grid gap-14 lg:grid-cols-2 lg:items-start">
        <FadeIn>
          <div className="relative mx-auto w-full max-w-sm">
            <span aria-hidden className="absolute -left-3 -top-3 z-0 h-full w-14 -skew-x-12 bg-lime" />
            <div className="relative z-10 aspect-[3/4] w-full overflow-hidden rounded-3xl">
              {coachProfile?.photo && <Image src={coachProfile.photo} alt={coachProfile?.name || "Coach"} fill className="object-cover" sizes="400px" />}
              <div className="absolute right-4 top-4 rounded-xl bg-white/95 px-4 py-2.5 text-navy-900 shadow-lg">
                <p className="text-label uppercase tracking-wide text-navy-400">{coachProfile?.competitorBadgeLabel || "ΑΓΩΝΙΣΤΗΣ"}</p>
                <p className="text-xsmall font-extrabold">{coachProfile?.competitorOrg || "NPC Worldwide"}</p>
                <p className="text-xsmall text-navy-500">{coachProfile?.competitorCategory || "Bodybuilding · Heavyweight"}</p>
              </div>
              <VideoPopupButton
                videoUrl={coachProfile?.introVideoUrl}
                className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/95 py-2 pl-2 pr-4 text-navy-900 shadow-lg"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-lime">
                  <Play className="h-3.5 w-3.5" />
                </span>
                <span className="text-left">
                  <span className="block text-xsmall font-extrabold leading-tight">{coachProfile?.videoLabel || "Δες το μήνυμά μου"}</span>
                  <span className="block text-label text-navy-500">{coachProfile?.videoDuration || "Βίντεο γνωριμίας · 1:20"}</span>
                </span>
              </VideoPopupButton>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <p className="flex items-center gap-3 text-eyebrow uppercase text-white/70 sm:text-eyebrow-d">
            <span className="h-[2px] w-8 bg-lime" />
            {coachProfile?.eyebrow || "Ο COACH ΣΟΥ"}
          </p>
          <h2 className="mt-4 text-h2b italic uppercase sm:text-h2b-d">
            {coachProfile?.name || "ΠΑΝΤΕΛΗΣ"}{" "}
            <span className="text-lime">{coachProfile?.nameHighlight || "ΣΤΑΥΡΟΥΛΑΚΗΣ"}</span>
            <span className="text-lime">.</span>
          </h2>
          <p className="mt-4 text-body font-semibold text-white/70">{coachProfile?.subtitle}</p>
          <p className="mt-5 max-w-xl text-body leading-relaxed text-white/60">{coachProfile?.bio}</p>

          {stats.length > 0 && (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((stat, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-4">
                  <p className="text-stat italic text-lime">{stat.value}</p>
                  <p className="mt-1 text-xsmall text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {achievements.length > 0 && (
            <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
              {achievements.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-3 text-body">
                  <span className="font-extrabold text-lime">{a.year}</span>
                  <span className="flex-1 font-semibold">{a.title}</span>
                  <span className="text-white/50">{a.result}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#pricing" className="btn-primary bg-lime text-navy-900">
              {coachProfile?.ctaLabel || "Δούλεψε μαζί μου"}
            </a>
            {coachProfile?.instagram && (
              <a href={coachProfile.instagram} target="_blank" rel="noreferrer" className="btn-secondary border border-white/20">
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            )}
            {coachProfile?.youtube && (
              <a href={coachProfile.youtube} target="_blank" rel="noreferrer" className="btn-secondary border border-white/20">
                <Youtube className="h-4 w-4" /> YouTube
              </a>
            )}
          </div>
        </FadeIn>
      </div>

      {coachProfile?.quote && (
        <FadeIn delay={0.1}>
          <div className="container-x relative z-10 mt-16 flex flex-col gap-6 border-t border-white/10 pt-12 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-2xl text-2xl font-semibold italic leading-snug sm:text-3xl">
              «{coachProfile.quote.replace(/^«|»$/g, "")}{" "}
              <span className="font-extrabold text-lime">{coachProfile?.quoteHighlight}</span>»
            </p>
            <div className="text-right">
              {settings?.logoWhite && (
                <Image src={settings.logoWhite} alt={settings?.siteName || "SP Team"} width={120} height={32} className="ml-auto h-7 w-auto" />
              )}
              <p className="mt-3 text-sm text-white/50">— {coachProfile?.quoteAuthor}</p>
            </div>
          </div>
        </FadeIn>
      )}
    </section>
  );
}
