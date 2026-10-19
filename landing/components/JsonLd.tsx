type JsonLdProps = {
  siteUrl: string;
  siteName: string;
  phone?: string;
  email?: string;
  address?: string;
  packages: Array<{ title?: string | null; price?: string | null; description?: string | null }>;
  faqs?: readonly { question?: string | null; answer?: string | null }[];
};

export function JsonLd({ siteUrl, siteName, phone, email, address, packages, faqs = [] }: JsonLdProps) {
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: siteName,
    url: siteUrl,
    image: `${siteUrl}/og-image.jpg`,
    telephone: phone || undefined,
    email: email || undefined,
    address: address
      ? {
          "@type": "PostalAddress",
          streetAddress: address,
        }
      : undefined,
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
