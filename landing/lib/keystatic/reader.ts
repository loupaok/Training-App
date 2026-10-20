import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../keystatic.config";

export const reader = createReader(process.cwd(), keystaticConfig);

export async function getSiteContent() {
  const [
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
  ] = await Promise.all([
    reader.singletons.settings.read(),
    reader.singletons.branding.read(),
    reader.singletons.seo.read(),
    reader.singletons.hero.read(),
    reader.singletons.featuresStrip.read(),
    reader.singletons.coachProfile.read(),
    reader.singletons.platformSection.read(),
    reader.singletons.planSection.read(),
    reader.singletons.pointsSection.read(),
    reader.singletons.servicesIntro.read(),
    reader.singletons.testimonialsIntro.read(),
    reader.singletons.faqSection.read(),
    reader.singletons.finalCta.read(),
  ]);

  return {
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
  };
}

export async function getTestimonials() {
  const slugs = await reader.collections.testimonials.list();
  const entries = await Promise.all(
    slugs.map(async (slug) => ({ slug, ...(await reader.collections.testimonials.read(slug)) }))
  );
  return entries
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getTermsPage() {
  return reader.singletons.termsPage.read();
}

export async function getPrivacyPage() {
  return reader.singletons.privacyPage.read();
}

export async function getCookiesPage() {
  return reader.singletons.cookiesPage.read();
}

export async function getPricingPlans() {
  const slugs = await reader.collections.pricingPlans.list();
  const entries = await Promise.all(
    slugs.map(async (slug) => ({ slug, ...(await reader.collections.pricingPlans.read(slug)) }))
  );
  return entries
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({ ...entry, currency: "EUR" }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
