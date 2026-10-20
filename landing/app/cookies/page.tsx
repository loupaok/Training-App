import type { Metadata } from "next";
import { getSiteContent, getCookiesPage } from "@/lib/keystatic/reader";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Πολιτική Cookies",
};

export default async function CookiesPage() {
  const [{ settings, branding }, cookiesPage] = await Promise.all([getSiteContent(), getCookiesPage()]);

  return <LegalPage settings={settings} branding={branding} heading={cookiesPage?.heading} content={cookiesPage?.content} />;
}
