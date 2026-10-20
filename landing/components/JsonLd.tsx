type JsonLdProps = {
  siteUrl: string;
  siteName: string;
  phone?: string;
  email?: string;
  description?: string;
  businessType?: string;
  serviceArea?: string;
  image?: string | null;
  latitude?: string;
  longitude?: string;
  sameAs?: readonly string[];
  packages: Array<{ title?: string | null; price?: string | null; description?: string | null }>;
  faqs?: readonly { question?: string | null; answer?: string | null }[];
};

export function JsonLd({ siteUrl, siteName, phone, email, description, businessType, serviceArea, image, latitude, longitude, sameAs = [], packages, faqs = [] }: JsonLdProps) {
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": businessType || "ProfessionalService",
    "@id": `${siteUrl}/#business`,
    name: siteName,
    url: siteUrl,
    image: image || `${siteUrl}/og-image.jpg`,
    description: description || undefined,
    telephone: phone || undefined,
    email: email || undefined,
    areaServed: serviceArea || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    geo: latitude && longitude ? { "@type": "GeoCoordinates", latitude, longitude } : undefined,
    priceRange: "€€",
  };

  const services = packages.map((pkg) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: pkg.title,
    provider: { "@type": "LocalBusiness", name: siteName, "@id": `${siteUrl}/#business` },
    description: pkg.description || undefined,
    offers: pkg.price
      ? {
          "@type": "Offer",
          price: pkg.price,
          priceCurrency: "EUR",
        }
      : undefined,
  }));

  const faqPage = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs
          .filter((faq) => faq.question && faq.answer)
          .map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
      }
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }} />
      {services.map((service, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(service) }} />
      ))}
      {faqPage && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />}
    </>
  );
}
