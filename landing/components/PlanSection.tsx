import Image from "next/image";
import { FadeIn } from "./FadeIn";
import type { getSiteContent } from "@/lib/keystatic/reader";

type PlanSection = Awaited<ReturnType<typeof getSiteContent>>["planSection"];

function Column({ title, items, highlight = false }: { title: string; items: readonly string[]; highlight?: boolean }) {
  if (!items.length) return null;
  return (
    <div className={`rounded-xl p-5 ${highlight ? "bg-lime text-navy-900" : "bg-white/10 backdrop-blur-sm"}`}>
      <p className="text-sm font-extrabold">{title}</p>
      <ul className={`mt-2 space-y-1 text-sm ${highlight ? "text-navy-800" : "text-white/70"}`}>
        {items.map((item, i) => (
          <li key={i}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function PlanSection({ planSection }: { planSection: PlanSection }) {
  return (
    <section id="plan" className="relative overflow-hidden py-20 text-white sm:py-28">
      <div className="absolute inset-0 -z-10">
        {planSection?.backgroundImage && <Image src={planSection.backgroundImage} alt="" fill className="object-cover" sizes="100vw" />}
        <div className="absolute inset-0 bg-navy-950/85" />
      </div>

      <div className="container-x">
        <FadeIn className="max-w-xl">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{planSection?.heading || "Ένα πλάνο 360° φτιαγμένο μόνο για σένα"}</h2>
          <p className="mt-4 text-white/70">{planSection?.description}</p>
          <a href="#pricing" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-navy-900">
            {planSection?.ctaLabel || "Ξεκίνα"}
          </a>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-12 flex items-center gap-3">
            <span className="relative h-11 w-11 overflow-hidden rounded-full bg-white/20">
              {planSection?.clientAvatar && <Image src={planSection.clientAvatar} alt={planSection?.clientName || ""} fill className="object-cover" sizes="44px" />}
            </span>
            <span>
              <span className="block text-sm font-extrabold">{planSection?.clientName || "Μαρία"}</span>
              <span className="block text-xs text-white/60">{planSection?.clientSince || "Μέλος · 12 εβδομάδες"}</span>
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Column title="Πρόγραμμα" items={planSection?.programme || []} />
            <Column title="Διατροφή" items={planSection?.nutrition || []} />
            <Column title="Στόχοι" items={planSection?.goals || []} />
            <Column title="Εξοπλισμός" items={planSection?.equipment || []} />
            <Column title="Ιστορικό" items={planSection?.history || []} />
            <Column title="Πόντοι" items={planSection?.pointsNote || []} highlight />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
