import type { MetadataRoute } from "next";
import { getSiteContent } from "@/lib/keystatic/reader";

export const dynamic = "force-dynamic";

const fallbackOrigin = "http://localhost:3100";

function getOrigin(canonicalUrl?: string | null) {
  return (canonicalUrl || process.env.NEXT_PUBLIC_SITE_URL || fallbackOrigin).replace(/\/$/, "");
}

function toAbsoluteUrl(href: string, origin: string) {
  return /^https?:\/\//i.test(href) ? href : new URL(href.startsWith("/") ? href : `/${href}`, origin).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { seo } = await getSiteContent();

  if (seo?.sitemapEnabled === false) {
    return [];
  }

  const origin = getOrigin(seo?.canonicalUrl);
  const now = new Date();
  const corePages = ["/", "/terms", "/privacy", "/cookies"];
  const extraPages = (seo?.sitemapExtraPages || [])
    .map((page) => page.href)
    .filter((href): href is string => Boolean(href) && !href.startsWith("#"));

  return [...new Set([...corePages, ...extraPages])].map((href) => ({
    url: toAbsoluteUrl(href, origin),
    lastModified: now,
  }));
}
