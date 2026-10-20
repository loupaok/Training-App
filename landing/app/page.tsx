import type { Metadata } from "next";
import { getSiteContent, getTestimonials, getPricingPlans } from "@/lib/keystatic/reader";
import { TickerBar } from "@/components/TickerBar";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeatureStrip } from "@/components/FeatureStrip";
import { CoachProfile } from "@/components/CoachProfile";
import { PlatformSection } from "@/components/PlatformSection";
import { PlanSection } from "@/components/PlanSection";
import { PointsSection } from "@/components/PointsSection";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Services } from "@/components/Services";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { FinalCta } from "@/components/FinalCta";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteContent();
  return {
    title: seo?.seoTitle || "SP Team — Personal Coaching",
    description: seo?.seoDescription || "Προσωπική προπόνηση και coaching από την ομάδα SP Team.",
    alternates: { canonical: seo?.canonicalUrl || siteUrl },
    keywords: seo?.keywords ? [...seo.keywords] : undefined,
  };
}

export default async function HomePage() {
  const [
    {
      settings,
      branding,
      seo,
      hero,
      featuresStrip,
      coachProfile,
      platformSection,
      planSection,
      pointsSection,
      servicesIntro,
      testimonialsIntro,
      faqSection,
      finalCta,
    },
    plans,
    testimonials,
  ] = await Promise.all([getSiteContent(), getPricingPlans(), getTestimonials()]);

  return (
    <>
      <JsonLd
        siteUrl={seo?.canonicalUrl || siteUrl}
        siteName={seo?.businessName || branding?.siteName || "SP Team"}
        phone={settings?.phone ?? undefined}
        email={settings?.email ?? undefined}
        description={seo?.businessDescription ?? undefined}
        businessType={seo?.businessType ?? undefined}
        serviceArea={seo?.serviceArea ?? undefined}
        image={seo?.ogImage}
        latitude={seo?.geoLatitude ?? undefined}
        longitude={seo?.geoLongitude ?? undefined}
        sameAs={(settings?.socialLinks || []).map((link) => link.url).filter((url): url is string => Boolean(url))}
        packages={plans.map((p) => ({ title: p.name, price: `${p.price} ${p.currency}`, description: p.description }))}
        faqs={faqSection?.items || []}
      />
      <TickerBar items={settings?.tickerItems || []} />
      <Header settings={settings} branding={branding} />
      <main>
        <Hero hero={hero} />
        <FeatureStrip featuresStrip={featuresStrip} />
        <CoachProfile coachProfile={coachProfile} branding={branding} />
        <PlatformSection platformSection={platformSection} />
        <PlanSection planSection={planSection} />
        <PointsSection pointsSection={pointsSection} />
        <BeforeAfter intro={testimonialsIntro} transformations={testimonials} />
        <Services intro={servicesIntro} plans={plans} />
        <FaqSection faqSection={faqSection} />
        <FinalCta finalCta={finalCta} />
      </main>
      <Footer settings={settings} branding={branding} />
    </>
  );
}
