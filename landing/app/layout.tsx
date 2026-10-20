import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Commissioner } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { getSiteContent } from "@/lib/keystatic/reader";

const commissioner = Commissioner({
  subsets: ["latin", "latin-ext", "greek"],
  variable: "--font-commissioner",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

export async function generateMetadata(): Promise<Metadata> {
  const { branding, seo } = await getSiteContent();
  const title = seo?.seoTitle || "SP Team — Personal Coaching";
  const description = seo?.seoDescription || "Προσωπική προπόνηση και coaching από την ομάδα SP Team.";
  const canonicalUrl = seo?.canonicalUrl || siteUrl;

  return {
    metadataBase: new URL(canonicalUrl),
    title: {
      default: title,
      template: `%s — ${branding?.siteName || "SP Team"}`,
    },
    description,
    keywords: seo?.keywords ? [...seo.keywords] : undefined,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: branding?.siteName || "SP Team",
      locale: "el_GR",
      type: "website",
      images: seo?.ogImage ? [{ url: seo.ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: seo?.robotsIndex ?? true, follow: seo?.robotsIndex ?? true },
    verification: seo?.googleSiteVerification ? { google: seo.googleSiteVerification } : undefined,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="el" className={commissioner.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
