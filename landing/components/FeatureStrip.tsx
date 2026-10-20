import type { getSiteContent } from "@/lib/keystatic/reader";

type FeaturesStrip = Awaited<ReturnType<typeof getSiteContent>>["featuresStrip"];

export function FeatureStrip({ featuresStrip }: { featuresStrip: FeaturesStrip }) {
  const items = featuresStrip?.items || [];
  if (!items.length) return null;

  return (
    <section className="border-t border-white/10 bg-navy-900 py-12 text-white sm:py-10">
      <div className="container-x grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-1 h-9 w-2 shrink-0 -skew-x-12 bg-lime sm:h-6 sm:w-1.5" aria-hidden />
            <div>
              <p className="text-base font-extrabold sm:text-h3">{item.title}</p>
              <p className="mt-1 text-sm leading-snug text-white/60 sm:mt-0.5 sm:text-xsmall">{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
