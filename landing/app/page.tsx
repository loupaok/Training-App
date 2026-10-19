import type { Metadata } from "next";
import { getSiteContent, getPackages, getCoaches, getTestimonials } from "@/lib/keystatic/reader";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Services } from "@/components/Services";
import { Coaches } from "@/components/Coaches";
import { Testimonials } from "@/components/Testimonials";
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
  const [{ settings, hero, servicesIntro, coachesIntro, testimonialsIntro, contact }, packages, coaches, testimonials] = await Promise.all([
    getSiteContent(),
    getPackages(),
    getCoaches(),
    getTestimonials(),
  ]);

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
      <Header settings={settings} />
      <main>
        <Hero hero={hero} />
        <Services intro={servicesIntro} packages={packages} />
        <Coaches intro={coachesIntro} coaches={coaches} />
        <Testimonials intro={testimonialsIntro} testimonials={testimonials} />
        <Contact contact={contact} settings={settings} />
      </main>
      <Footer settings={settings} />
    </>
  );
}
