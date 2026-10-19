import type { Metadata } from "next";
import { getSiteContent, getTestimonials } from "@/lib/keystatic/reader";
import { getPricingPlans } from "@/lib/pricing";
import { TickerBar } from "@/components/TickerBar";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { CoachProfile } from "@/components/CoachProfile";
import { DirectWorkSection } from "@/components/DirectWorkSection";
import { PlanSection } from "@/components/PlanSection";
import { PointsSection } from "@/components/PointsSection";
import { Testimonials } from "@/components/Testimonials";
import { Services } from "@/components/Services";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { FinalCta } from "@/components/FinalCta";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteContent();
  return {
    title: settings?.seoTitle || "SP Team — Personal Coaching",
    description: settings?.seoDescription || "Προσωπική προπόνηση και coaching από την ομάδα SP Team.",
    alternates: { canonical: siteUrl },
  };
}

export default async function HomePage() {
  const [
    {
      settings,
      hero,
      coachProfile,
      directWorkSection,
      planSection,
      pointsSection,
      servicesIntro,
      testimonialsIntro,
    },
    plans,
    testimonials,
  ] = await Promise.all([getSiteContent(), getPricingPlans(), getTestimonials()]);

  return (
    <>
      <JsonLd
        siteUrl={siteUrl}
        siteName={settings?.siteName || "SP Team"}
        phone={settings?.phone ?? undefined}
        email={settings?.email ?? undefined}
        address={settings?.address ?? undefined}
        packages={plans.map((p) => ({ title: p.name, price: `${p.price} ${p.currency}`, description: p.description }))}
      />
      <TickerBar items={settings?.tickerItems || []} />
      <Header settings={settings} />
      <main>
        <Hero hero={hero} />
        <CoachProfile coachProfile={coachProfile} />
        <DirectWorkSection directWorkSection={directWorkSection} />
        <PlanSection planSection={planSection} />
        <PointsSection pointsSection={pointsSection} />
        <Testimonials intro={testimonialsIntro} testimonials={testimonials} />
        <Services intro={servicesIntro} plans={plans} />
        <FaqSection />
        <FinalCta hero={hero} />
      </main>
      <Footer settings={settings} />
    </>
  );
}
