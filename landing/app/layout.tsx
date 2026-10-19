import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { getSiteContent } from "@/lib/keystatic/reader";

const inter = Inter({ subsets: ["latin", "latin-ext", "greek"], variable: "--font-inter" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteContent();
  const title = settings?.seoTitle || "SP Team — Personal Coaching";
  const description = settings?.seoDescription || "Προσωπική προπόνηση και coaching από την ομάδα SP Team.";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s — ${settings?.siteName || "SP Team"}`,
    },
    description,
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: settings?.siteName || "SP Team",
      locale: "el_GR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="el" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
