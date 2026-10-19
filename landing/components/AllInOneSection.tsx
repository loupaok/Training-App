import Image from "next/image";
import { FadeIn } from "./FadeIn";
import type { getSiteContent } from "@/lib/keystatic/reader";

type AllInOneSection = Awaited<ReturnType<typeof getSiteContent>>["allInOneSection"];

export function AllInOneSection({ allInOneSection }: { allInOneSection: AllInOneSection }) {
  const exercises = allInOneSection?.trainingExercises || [];
  const macros = allInOneSection?.nutritionMacros || [];

  return (
    <section className="bg-white py-20 dark:bg-navy-900 sm:py-28">
      <div className="container-x">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <FadeIn className="max-w-lg">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{allInOneSection?.heading || "Όλα όσα χρειάζεσαι, σε ένα σημείο"}</h2>
          </FadeIn>
          <FadeIn delay={0.05} className="max-w-sm text-navy-600 dark:text-white/60">
            <p>{allInOneSection?.description}</p>
          </FadeIn>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <FadeIn>
            <div className="flex h-full flex-col rounded-2xl bg-navy-50 p-6 dark:bg-white/5">
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-navy-800">
                <p className="text-xs font-bold text-navy-400 dark:text-white/40">{allInOneSection?.trainingDayLabel || "Ημέρα 3 · Push"}</p>
                <div className="mt-3 space-y-2">
                  {exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{ex.name}</span>
                      <span className="text-navy-400 dark:text-white/40">{ex.sets}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-4 w-full rounded-full bg-navy-900 py-2.5 text-xs font-bold text-white dark:bg-white dark:text-navy-900">
                  {allInOneSection?.trainingCtaLabel || "Ξεκίνα προπόνηση"}
                </button>
              </div>
              <p className="mt-5 text-lg font-extrabold">{allInOneSection?.trainingTitle || "Προπόνηση"}</p>
              <p className="mt-2 text-sm text-navy-600 dark:text-white/60">{allInOneSection?.trainingDescription}</p>
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="flex h-full flex-col rounded-2xl bg-navy-50 p-6 dark:bg-white/5">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                {allInOneSection?.nutritionPhoto && (
                  <Image src={allInOneSection.nutritionPhoto} alt="" fill className="object-cover" sizes="400px" />
                )}
                {macros.length > 0 && (
                  <div className="absolute inset-x-3 bottom-3 flex justify-between rounded-lg bg-white/95 px-3 py-2 text-center">
                    {macros.map((m, i) => (
                      <div key={i}>
                        <p className="text-sm font-black text-navy-900">{m.value}</p>
                        <p className="text-[10px] text-navy-500">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-5 text-lg font-extrabold">{allInOneSection?.nutritionTitle || "Διατροφή"}</p>
              <p className="mt-2 text-sm text-navy-600 dark:text-white/60">{allInOneSection?.nutritionDescription}</p>
            </div>
          </FadeIn>

          <FadeIn delay={0.16}>
            <div className="flex h-full flex-col rounded-2xl bg-navy-900 p-6 text-white">
              <div className="space-y-2 rounded-xl bg-white/10 p-4">
                <p className="max-w-[85%] rounded-lg bg-white/15 px-3 py-2 text-xs">{allInOneSection?.checkinsQuestion}</p>
                <p className="ml-auto max-w-[85%] rounded-lg bg-lime px-3 py-2 text-xs font-semibold text-navy-900">{allInOneSection?.checkinsReplyClient}</p>
                <p className="max-w-[85%] rounded-lg bg-white/15 px-3 py-2 text-xs">{allInOneSection?.checkinsReplyCoach}</p>
              </div>
              <p className="mt-5 text-lg font-extrabold">{allInOneSection?.checkinsTitle || "Check-ins στο Discord"}</p>
              <p className="mt-2 text-sm text-white/60">{allInOneSection?.checkinsDescription}</p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
