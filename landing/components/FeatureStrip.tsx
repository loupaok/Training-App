import type { getSiteContent } from "@/lib/keystatic/reader";

type FeaturesStrip = Awaited<ReturnType<typeof getSiteContent>>["featuresStrip"];

export function FeatureStrip({ featuresStrip }: { featuresStrip: FeaturesStrip }) {
  const items = featuresStrip?.items || [];
  if (!items.length) return null;

  return (
    <section className="border-t border-white/10 bg-navy-900 py-10 text-white">
      <div className="container-x grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-1 h-6 w-1.5 shrink-0 -skew-x-12 bg-lime" aria-hidden />
            <div>
              <p className="text-h3">{item.title}</p>
              <p className="mt-0.5 text-xsmall text-white/60">{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
