import type { Metadata } from "next";
import { getSiteContent, getPrivacyPage } from "@/lib/keystatic/reader";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Πολιτική Απορρήτου",
};

export default async function PrivacyPage() {
  const [{ settings, branding }, privacyPage] = await Promise.all([getSiteContent(), getPrivacyPage()]);

  return <LegalPage settings={settings} branding={branding} heading={privacyPage?.heading} content={privacyPage?.content} />;
}
