import type { Metadata } from "next";
import { getSiteContent, getPackages, getTestimonials } from "@/lib/keystatic/reader";
import { TickerBar } from "@/components/TickerBar";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FeatureStrip } from "@/components/FeatureStrip";
import { ExpertsSection } from "@/components/ExpertsSection";
import { CoachProfile } from "@/components/CoachProfile";
import { DirectWorkSection } from "@/components/DirectWorkSection";
import { PlanSection } from "@/components/PlanSection";
import { AllInOneSection } from "@/components/AllInOneSection";
import { PointsSection } from "@/components/PointsSection";
import { Testimonials } from "@/components/Testimonials";
import { Services } from "@/components/Services";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";

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
      featuresStrip,
      expertsSection,
      coachProfile,
      directWorkSection,
      planSection,
      allInOneSection,
      pointsSection,
      servicesIntro,
      testimonialsIntro,
      contact,
    },
    packages,
    testimonials,
  ] = await Promise.all([getSiteContent(), getPackages(), getTestimonials()]);

  return (
    <>
      <JsonLd
        siteUrl={siteUrl}
        siteName={settings?.siteName || "SP Team"}
        phone={settings?.phone ?? undefined}
        email={settings?.email ?? undefined}
        address={settings?.address ?? undefined}
        packages={packages.map((p) => ({ title: p.title, price: p.price, description: p.description }))}
      />
      <TickerBar items={settings?.tickerItems || []} />
      <Header settings={settings} />
      <main>
        <Hero hero={hero} />
        <FeatureStrip featuresStrip={featuresStrip} />
        <ExpertsSection expertsSection={expertsSection} />
        <CoachProfile coachProfile={coachProfile} />
        <DirectWorkSection directWorkSection={directWorkSection} />
        <PlanSection planSection={planSection} />
        <AllInOneSection allInOneSection={allInOneSection} />
        <PointsSection pointsSection={pointsSection} />
        <Testimonials intro={testimonialsIntro} testimonials={testimonials} />
        <Services intro={servicesIntro} packages={packages} />
        <Contact contact={contact} settings={settings} />
      </main>
      <Footer settings={settings} />
    </>
  );
}
