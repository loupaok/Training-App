import Image from "next/image";
import { FadeIn } from "./FadeIn";
import { Play, Star, MessageCircle } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type DirectWorkSection = Awaited<ReturnType<typeof getSiteContent>>["directWorkSection"];

export function DirectWorkSection({ directWorkSection }: { directWorkSection: DirectWorkSection }) {
  const checkinStats = directWorkSection?.checkinStats || [];

  return (
    <section className="bg-navy-900 py-20 text-white sm:py-28">
      <div className="container-x text-center">
        <FadeIn>
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            {directWorkSection?.heading || "Δουλεύεις απευθείας με τον Παντελή"}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">{directWorkSection?.description}</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative mx-auto mt-14 w-full max-w-[300px]">
            <div className="relative overflow-hidden rounded-[2.2rem] border-[6px] border-white bg-white shadow-2xl">
              <div className="flex items-center gap-2 px-4 pb-3 pt-5 text-left text-navy-900">
                <span className="h-8 w-8 overflow-hidden rounded-full bg-navy-100">
                  <span className="grid h-full w-full place-items-center text-[10px] font-bold text-navy-500">SP</span>
                </span>
                <span>
                  <span className="block text-xs font-extrabold leading-tight">{directWorkSection?.chatHeading || "Coach Παντελής"}</span>
                  <span className="block text-[10px] text-navy-400">{directWorkSection?.chatChannel || "# weekly-check-in"}</span>
                </span>
              </div>
              <div className="relative aspect-[4/5] w-full">
                {directWorkSection?.phoneImage && (
                  <Image src={directWorkSection.phoneImage} alt="" fill className="object-cover" sizes="300px" />
                )}
                <button
                  type="button"
                  className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-navy-900"
                >
                  <Play className="h-3 w-3" />
                  <span className="text-[10px] font-bold">{directWorkSection?.videoLabel || "Video feedback · 0:48"}</span>
                </button>
              </div>
            </div>

            <div className="absolute -left-36 top-20 hidden w-40 rounded-xl bg-white p-4 text-left text-navy-900 shadow-xl sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wide text-navy-400">{directWorkSection?.checkinLabel || "ΕΒΔΟΜΑΔΙΑΙΟ CHECK-IN"}</p>
              <div className="mt-2 space-y-1.5">
                {checkinStats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-navy-500">{stat.label}</span>
                    <span className="font-bold">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -left-10 top-[58%] hidden max-w-[220px] rounded-xl bg-navy-800 p-3 text-left text-xs font-semibold shadow-xl sm:block">
              {directWorkSection?.chatMessage}
            </div>

            <div className="absolute -bottom-2 -left-4 flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-xs font-bold text-navy-900 shadow-lg sm:left-auto sm:-right-2">
              <Star className="h-3.5 w-3.5" filled />
              {directWorkSection?.renewalBadge || "Συνδρομή ανανεώθηκε · +[X] πόντοι"}
            </div>

            <div className="absolute -right-40 top-28 hidden items-center gap-3 rounded-xl bg-white p-3 text-left text-navy-900 shadow-xl sm:flex">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#5865F2] text-white">
                <MessageCircle className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-extrabold leading-tight">{directWorkSection?.discordLabel || "Μιλάτε στο Discord"}</span>
                <span className="block text-[10px] text-navy-500">{directWorkSection?.discordSub || "Μηνύματα, φωνητικά & video"}</span>
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
