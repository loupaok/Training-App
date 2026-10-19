import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../keystatic.config";

export const reader = createReader(process.cwd(), keystaticConfig);

export async function getSiteContent() {
  const [
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
  ] = await Promise.all([
    reader.singletons.settings.read(),
    reader.singletons.hero.read(),
    reader.singletons.featuresStrip.read(),
    reader.singletons.expertsSection.read(),
    reader.singletons.coachProfile.read(),
    reader.singletons.directWorkSection.read(),
    reader.singletons.planSection.read(),
    reader.singletons.allInOneSection.read(),
    reader.singletons.pointsSection.read(),
    reader.singletons.servicesIntro.read(),
    reader.singletons.testimonialsIntro.read(),
    reader.singletons.contact.read(),
  ]);

  return {
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
