import { TickerBar } from "./TickerBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import type { getSiteContent } from "@/lib/keystatic/reader";

type Settings = Awaited<ReturnType<typeof getSiteContent>>["settings"];
type Branding = Awaited<ReturnType<typeof getSiteContent>>["branding"];

export function LegalPage({
  settings,
  branding,
  heading,
  content,
}: {
  settings: Settings;
  branding?: Branding;
  heading?: string | null;
  content?: string | null;
}) {
  const paragraphs = (content || "").split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <TickerBar items={settings?.tickerItems || []} />
      <Header settings={settings} branding={branding} />
      <main className="flex-1 border-y border-white/10 bg-navy-900 pb-20 pt-36 text-white sm:pt-40">
        <div className="container-x max-w-3xl">
          <h1 className="text-h2l sm:text-h2l-d">{heading}</h1>
          <div className="mt-8 space-y-5 text-body leading-relaxed text-white/70">
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </main>
      <Footer settings={settings} branding={branding} />
    </div>
  );
}
