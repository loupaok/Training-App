import type { MetadataRoute } from "next";
import { getSiteContent } from "@/lib/keystatic/reader";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { seo } = await getSiteContent();
  const origin = (seo?.canonicalUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/$/, "");
  const shouldIndex = seo?.robotsIndex !== false;

  return {
    rules: shouldIndex
      ? { userAgent: "*", allow: "/", disallow: ["/keystatic/", "/api/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: seo?.sitemapEnabled === false ? undefined : `${origin}/sitemap.xml`,
    host: origin,
  };
}
