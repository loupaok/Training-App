import { FadeIn } from "./FadeIn";
import type { getSiteContent } from "@/lib/keystatic/reader";

type PointsSection = Awaited<ReturnType<typeof getSiteContent>>["pointsSection"];

export function PointsSection({ pointsSection }: { pointsSection: PointsSection }) {
  const bonusItems = pointsSection?.bonusItems || [];
  const historyItems = pointsSection?.historyItems || [];
  const redemptionOptions = pointsSection?.redemptionOptions || [];

  return (
    <section id="points" className="bg-lime py-0 text-navy-900 sm:py-28">
      <div className="container-x grid gap-9 bg-lime px-5 py-8 sm:gap-12 sm:bg-transparent sm:px-8 sm:py-0 lg:grid-cols-2 lg:items-start lg:px-10">
        <FadeIn>
          <p className="text-eyebrow uppercase sm:text-eyebrow-d">{pointsSection?.eyebrow || "ΣΥΣΤΗΜΑ ΠΟΝΤΩΝ"}</p>
          <h2 className="mt-4 text-h2b italic uppercase sm:text-h2b-d">
            <span className="block">{pointsSection?.titleLine1 || "ΜΕΝΕΙΣ."}</span>
            <span className="block">{pointsSection?.titleLine2 || "ΚΕΡΔΙΖΕΙΣ."}</span>
          </h2>
          <p className="mt-5 max-w-md text-body text-navy-800/80">{pointsSection?.description}</p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-navy-900 p-4 text-white">
              <p className="text-stat italic">{pointsSection?.baseRateValue || "1€ = [X] pts"}</p>
              <p className="mt-1 text-xsmall text-white/60">{pointsSection?.baseRateLabel}</p>
            </div>
            {bonusItems.map((item, i) => (
              <div key={i} className="rounded-xl bg-navy-900 p-4 text-white">
                <p className="text-stat italic">{item.value}</p>
                <p className="mt-1 text-xsmall text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-2xl bg-navy-950 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xsmall font-extrabold">{pointsSection?.walletHeading || "Το πορτοφόλι σου"}</p>
              <span className="text-xsmall font-black">SP TEAM</span>
            </div>

            <div className="mt-5 rounded-xl bg-white/5 p-5">
              <p className="text-label text-white/50">{pointsSection?.availablePointsLabel || "Διαθέσιμοι πόντοι"}</p>
              <p className="mt-1 text-stat italic text-lime">{pointsSection?.availablePoints || "[X] pts"}</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-lime" />
              </div>
              <p className="mt-3 text-label text-white/50">{pointsSection?.pointsToNextLabel}</p>
            </div>

            {historyItems.length > 0 && (
              <div className="mt-4 divide-y divide-white/10">
                {historyItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 text-body">
                    <span>
                      <span className="block font-semibold">{item.title}</span>
                      <span className="block text-label text-white/40">{item.subtitle}</span>
                    </span>
                    <span className="font-bold text-lime">{item.amount}</span>
                  </div>
                ))}
              </div>
            )}

            {redemptionOptions.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {redemptionOptions.map((opt, i) => (
                  <div key={i} className="rounded-lg bg-white/5 p-3 text-center">
                    <p className="text-label font-semibold">{opt.label}</p>
                    <p className="mt-1 text-label text-white/50">{opt.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
