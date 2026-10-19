import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../keystatic.config";

export const reader = createReader(process.cwd(), keystaticConfig);

export async function getSiteContent() {
  const [settings, hero, servicesIntro, coachesIntro, testimonialsIntro, contact] = await Promise.all([
    reader.singletons.settings.read(),
    reader.singletons.hero.read(),
    reader.singletons.servicesIntro.read(),
    reader.singletons.coachesIntro.read(),
    reader.singletons.testimonialsIntro.read(),
    reader.singletons.contact.read(),
  ]);

  return { settings, hero, servicesIntro, coachesIntro, testimonialsIntro, contact };
}

export async function getPackages() {
  const slugs = await reader.collections.packages.list();
  const entries = await Promise.all(
    slugs.map(async (slug) => ({ slug, ...(await reader.collections.packages.read(slug)) }))
  );
  return entries
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getCoaches() {
  const slugs = await reader.collections.coaches.list();
  const entries = await Promise.all(
    slugs.map(async (slug) => ({ slug, ...(await reader.collections.coaches.read(slug)) }))
  );
  return entries
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
