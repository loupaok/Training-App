import type { Metadata } from "next";
import { getSiteContent, getTermsPage } from "@/lib/keystatic/reader";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Όροι χρήσης",
};

export default async function TermsPage() {
  const [{ settings, branding }, termsPage] = await Promise.all([getSiteContent(), getTermsPage()]);

  return <LegalPage settings={settings} branding={branding} heading={termsPage?.heading} content={termsPage?.content} />;
}
