import { config, fields, collection, singleton } from "@keystatic/core";

const imageField = (label: string) =>
  fields.image({
    label,
    directory: "public/uploads",
    publicPath: "/uploads/",
  });

export default config({
  storage: {
    kind: "local",
  },
  ui: {
    brand: { name: "SP Team — Admin" },
  },
  singletons: {
    settings: singleton({
      label: "Γενικές Ρυθμίσεις",
      path: "content/settings",
      schema: {
        siteName: fields.text({ label: "Όνομα εταιρίας", defaultValue: "SP Team" }),
        logo: imageField("Logo"),
        tagline: fields.text({ label: "Σύνθημα (tagline)", defaultValue: "Personal Coaching" }),
        navLinks: fields.array(
          fields.object({
            label: fields.text({ label: "Κείμενο" }),
            href: fields.text({ label: "Σύνδεσμος (π.χ. #services)" }),
          }),
          {
            label: "Σύνδεσμοι Navigation",
            itemLabel: (props) => props.fields.label.value || "Σύνδεσμος",
          }
        ),
        phone: fields.text({ label: "Τηλέφωνο" }),
        email: fields.text({ label: "Email" }),
        address: fields.text({ label: "Διεύθυνση" }),
        socialLinks: fields.array(
          fields.object({
            platform: fields.select({
              label: "Πλατφόρμα",
              options: [
                { label: "Instagram", value: "instagram" },
                { label: "Facebook", value: "facebook" },
                { label: "TikTok", value: "tiktok" },
                { label: "YouTube", value: "youtube" },
              ],
              defaultValue: "instagram",
            }),
            url: fields.url({ label: "Σύνδεσμος" }),
          }),
          { label: "Social Media", itemLabel: (props) => props.fields.platform.value }
        ),
        footerText: fields.text({
          label: "Κείμενο footer",
          defaultValue: `© ${new Date().getFullYear()} SP Team. Με επιφύλαξη παντός δικαιώματος.`,
        }),
        seoTitle: fields.text({ label: "SEO Τίτλος (default)", defaultValue: "SP Team — Personal Coaching" }),
        seoDescription: fields.text({
          label: "SEO Περιγραφή (default)",
          multiline: true,
          defaultValue: "Προσωπική προπόνηση και coaching μεθοδολογία από την ομάδα SP Team.",
        }),
      },
    }),
    hero: singleton({
      label: "Hero Section",
      path: "content/hero",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος πάνω", defaultValue: "SP Team Personal Coaching" }),
        heading: fields.text({ label: "Κύριος τίτλος", multiline: true, defaultValue: "Το σώμα και το μυαλό σου, ανεβασμένα σε άλλο επίπεδο." }),
        subheading: fields.text({
          label: "Υπότιτλος",
          multiline: true,
          defaultValue: "Προσωπικά πλάνα προπόνησης και διατροφής, σχεδιασμένα γύρω από εσένα.",
        }),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού", defaultValue: "Κλείσε Δωρεάν Ραντεβού" }),
        ctaHref: fields.text({ label: "Σύνδεσμος κουμπιού", defaultValue: "#contact" }),
        image: imageField("Εικόνα Hero"),
      },
    }),
    servicesIntro: singleton({
      label: "Εισαγωγή Υπηρεσιών",
      path: "content/services-intro",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Πακέτα" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Διάλεξε το πλάνο που ταιριάζει σε σένα" }),
        subheading: fields.text({ label: "Υπότιτλος", multiline: true, defaultValue: "" }),
      },
    }),
    coachesIntro: singleton({
      label: "Εισαγωγή Ομάδας",
      path: "content/coaches-intro",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Η Ομάδα" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Γνώρισε τους coaches μας" }),
        subheading: fields.text({ label: "Υπότιτλος", multiline: true, defaultValue: "" }),
      },
    }),
    testimonialsIntro: singleton({
      label: "Εισαγωγή Testimonials",
      path: "content/testimonials-intro",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Αποτελέσματα" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Τι λένε οι πελάτες μας" }),
      },
    }),
    contact: singleton({
      label: "Επικοινωνία",
      path: "content/contact",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Επικοινωνία" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Ξεκίνα το ταξίδι σου σήμερα" }),
        subheading: fields.text({
          label: "Υπότιτλος",
          multiline: true,
          defaultValue: "Συμπλήρωσε τη φόρμα και θα επικοινωνήσουμε μαζί σου εντός 24 ωρών.",
        }),
      },
    }),
  },
  collections: {
    packages: collection({
      label: "Πακέτα & Τιμές",
      path: "content/packages/*",
      slugField: "title",
      schema: {
        title: fields.slug({ name: { label: "Τίτλος πακέτου" } }),
        price: fields.text({ label: "Τιμή (π.χ. 90€)" }),
        period: fields.text({ label: "Περίοδος (π.χ. /μήνα)", defaultValue: "/μήνα" }),
        description: fields.text({ label: "Σύντομη περιγραφή", multiline: true }),
        features: fields.array(fields.text({ label: "Χαρακτηριστικό" }), {
          label: "Χαρακτηριστικά πακέτου",
          itemLabel: (props) => props.value || "Χαρακτηριστικό",
        }),
        highlighted: fields.checkbox({ label: "Προτεινόμενο πακέτο", defaultValue: false }),
        order: fields.integer({ label: "Σειρά εμφάνισης", defaultValue: 0 }),
      },
    }),
    coaches: collection({
      label: "Coaches",
      path: "content/coaches/*",
      slugField: "name",
      schema: {
        name: fields.slug({ name: { label: "Όνομα" } }),
        role: fields.text({ label: "Ειδικότητα / Ρόλος" }),
        photo: imageField("Φωτογραφία"),
        bio: fields.text({ label: "Σύντομο βιογραφικό", multiline: true }),
        instagram: fields.url({ label: "Instagram link", validation: { isRequired: false } }),
        order: fields.integer({ label: "Σειρά εμφάνισης", defaultValue: 0 }),
      },
    }),
    testimonials: collection({
      label: "Testimonials",
      path: "content/testimonials/*",
      slugField: "name",
      schema: {
        name: fields.slug({ name: { label: "Όνομα πελάτη" } }),
        role: fields.text({ label: "Ιδιότητα (π.χ. 'Έχασε 12kg')", validation: { isRequired: false } }),
        photo: imageField("Φωτογραφία"),
        quote: fields.text({ label: "Μαρτυρία", multiline: true }),
        rating: fields.integer({ label: "Βαθμολογία (1-5)", defaultValue: 5, validation: { min: 1, max: 5 } }),
        order: fields.integer({ label: "Σειρά εμφάνισης", defaultValue: 0 }),
      },
    }),
  },
});
