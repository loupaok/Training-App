import { config, fields, collection, singleton } from "@keystatic/core";

const imageField = (label: string, defaultValue?: string) =>
  fields.image({
    label,
    directory: "public/uploads",
    publicPath: "/uploads/",
    ...(defaultValue ? { defaultValue } : {}),
  });

const statField = (valueDefault: string, labelDefault: string) =>
  fields.object({
    value: fields.text({ label: "Τιμή", defaultValue: valueDefault }),
    label: fields.text({ label: "Ετικέτα", defaultValue: labelDefault }),
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
        tickerItems: fields.array(fields.text({ label: "Κείμενο" }), {
          label: "Κυλιόμενη μπάρα (πάνω από το header)",
          itemLabel: (props) => props.value || "Κείμενο",
        }),
        navLinks: fields.array(
          fields.object({
            label: fields.text({ label: "Κείμενο" }),
            href: fields.text({ label: "Σύνδεσμος (π.χ. #coach)" }),
          }),
          {
            label: "Σύνδεσμοι Navigation",
            itemLabel: (props) => props.fields.label.value || "Σύνδεσμος",
          }
        ),
        footerNavigationTitle: fields.text({ label: "Τίτλος μενού footer 1", defaultValue: "Πλοήγηση" }),
        footerNavigationLinks: fields.array(
          fields.object({
            label: fields.text({ label: "Κείμενο" }),
            href: fields.text({ label: "Σύνδεσμος" }),
          }),
          { label: "Μενού footer 1", itemLabel: (props) => props.fields.label.value || "Σύνδεσμος" }
        ),
        footerMembersTitle: fields.text({ label: "Τίτλος μενού footer 2", defaultValue: "Μέλη" }),
        footerMembersLinks: fields.array(
          fields.object({
            label: fields.text({ label: "Κείμενο" }),
            href: fields.text({ label: "Σύνδεσμος" }),
          }),
          { label: "Μενού footer 2", itemLabel: (props) => props.fields.label.value || "Σύνδεσμος" }
        ),
        loginLabel: fields.text({ label: "Κείμενο 'Σύνδεση'", defaultValue: "Σύνδεση" }),
        loginHref: fields.text({ label: "Σύνδεσμος 'Σύνδεση'", defaultValue: "/login" }),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού header", defaultValue: "Ξεκίνα" }),
        ctaHref: fields.text({ label: "Σύνδεσμος κουμπιού header", defaultValue: "#pricing" }),
        phone: fields.text({ label: "Τηλέφωνο" }),
        email: fields.text({ label: "Email" }),
        footerContactTitle: fields.text({ label: "Τίτλος ενότητας επικοινωνίας footer", defaultValue: "Επικοινωνία" }),
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
          defaultValue: "SP Team",
        }),
        footerDescription: fields.text({
          label: "Περιγραφή footer",
          multiline: true,
          defaultValue: "Προσωπικό coaching με πλάνο προπόνησης, διατροφής και συνεχή καθοδήγηση.",
        }),
        footerCtaLabel: fields.text({ label: "Κείμενο κουμπιού footer", defaultValue: "Ξεκίνα" }),
        footerCtaHref: fields.text({ label: "Σύνδεσμος κουμπιού footer", defaultValue: "#pricing" }),
        footerLegalLinks: fields.array(
          fields.object({
            label: fields.text({ label: "Κείμενο" }),
            href: fields.text({ label: "Σύνδεσμος" }),
          }),
          { label: "Links κάτω μπάρας footer", itemLabel: (props) => props.fields.label.value || "Σύνδεσμος" }
        ),
      },
    }),
    branding: singleton({
      label: "Branding",
      path: "content/branding",
      schema: {
        siteName: fields.text({ label: "Όνομα brand", defaultValue: "SP Team" }),
        tagline: fields.text({ label: "Σύνθημα (tagline)", defaultValue: "Consistency creates results" }),
        logoBlack: imageField("Λογότυπο για ανοιχτό φόντο", "/uploads/seed-logo-black.svg"),
        logoWhite: imageField("Λογότυπο για σκούρο φόντο", "/uploads/seed-logo-white.svg"),
      },
    }),
    seo: singleton({
      label: "SEO & GEO",
      path: "content/seo",
      schema: {
        seoTitle: fields.text({ label: "SEO τίτλος", defaultValue: "SP Team — Personal Coaching" }),
        seoDescription: fields.text({
          label: "Meta περιγραφή",
          multiline: true,
          defaultValue: "Η συνέπεια φέρνει αποτέλεσμα — προσωπικό coaching, πλάνο προπόνησης & διατροφής από την ομάδα SP Team.",
        }),
        canonicalUrl: fields.url({ label: "Canonical URL", validation: { isRequired: false } }),
        ogImage: imageField("Open Graph εικόνα (social sharing)"),
        keywords: fields.array(fields.text({ label: "Λέξη ή φράση" }), {
          label: "SEO keywords",
          itemLabel: (props) => props.value || "Keyword",
        }),
        robotsIndex: fields.checkbox({ label: "Να εμφανίζεται στις μηχανές αναζήτησης", defaultValue: true }),
        googleSiteVerification: fields.text({ label: "Google Search Console verification", validation: { isRequired: false } }),
        businessName: fields.text({ label: "Όνομα επιχείρησης για SEO/GEO", defaultValue: "SP Team" }),
        businessDescription: fields.text({
          label: "Περιγραφή επιχείρησης για AI & local search",
          multiline: true,
          defaultValue: "Online personal coaching με εξατομικευμένη προπόνηση, διατροφή και συνεχή υποστήριξη.",
        }),
        businessType: fields.select({
          label: "Τύπος επιχείρησης (structured data)",
          options: [
            { label: "Professional Service", value: "ProfessionalService" },
            { label: "Health Club", value: "HealthClub" },
            { label: "Local Business", value: "LocalBusiness" },
          ],
          defaultValue: "ProfessionalService",
        }),
        serviceArea: fields.text({ label: "Περιοχή εξυπηρέτησης", defaultValue: "Ελλάδα και online" }),
        geoLatitude: fields.text({ label: "Γεωγραφικό πλάτος (προαιρετικό)", validation: { isRequired: false } }),
        geoLongitude: fields.text({ label: "Γεωγραφικό μήκος (προαιρετικό)", validation: { isRequired: false } }),
        sitemapEnabled: fields.checkbox({ label: "Ενεργό sitemap.xml", defaultValue: true }),
        sitemapExtraPages: fields.array(
          fields.object({
            label: fields.text({ label: "Όνομα σελίδας" }),
            href: fields.text({ label: "Διαδρομή ή URL (π.χ. /contact)" }),
          }),
          { label: "Επιπλέον σελίδες sitemap", itemLabel: (props) => props.fields.label.value || "Σελίδα" }
        ),
        llmsEnabled: fields.checkbox({ label: "Ενεργό llms.txt", defaultValue: true }),
        llmsTitle: fields.text({ label: "Τίτλος llms.txt", defaultValue: "SP Team — Personal Coaching" }),
        llmsDescription: fields.text({
          label: "Σύντομη περιγραφή για AI",
          multiline: true,
          defaultValue: "Online personal coaching με εξατομικευμένη προπόνηση, διατροφή και συνεχή υποστήριξη.",
        }),
        llmsContent: fields.text({
          label: "Πρόσθετες οδηγίες για AI",
          multiline: true,
          defaultValue: "Χρησιμοποίησε τα τρέχοντα πακέτα και τις τιμές της σελίδας ως την έγκυρη πηγή πληροφοριών.",
        }),
        llmsLinks: fields.array(
          fields.object({
            label: fields.text({ label: "Τίτλος link" }),
            href: fields.text({ label: "Διαδρομή ή URL" }),
            description: fields.text({ label: "Περιγραφή", validation: { isRequired: false } }),
          }),
          { label: "Χρήσιμα links για llms.txt", itemLabel: (props) => props.fields.label.value || "Link" }
        ),
      },
    }),
    hero: singleton({
      label: "Hero Section",
      path: "content/hero",
      schema: {
        badgeLabel: fields.text({ label: "Ετικέτα πάνω από τον τίτλο", defaultValue: "CONSISTENCY CREATES RESULTS" }),
        headingLine1: fields.text({ label: "Τίτλος γραμμή 1", defaultValue: "Η ΣΥΝΕΠΕΙΑ" }),
        headingLine2: fields.text({ label: "Τίτλος γραμμή 2", defaultValue: "ΦΕΡΝΕΙ" }),
        headingHighlight: fields.text({ label: "Τίτλος γραμμή 3 (lime)", defaultValue: "ΑΠΟΤΕΛΕΣΜΑ." }),
        description: fields.text({
          label: "Περιγραφή",
          multiline: true,
          defaultValue:
            "Ο δικός σου coach, ένα πλάνο προπόνησης και διατροφής μόνο για σένα, και απευθείας επικοινωνία μαζί του στο Discord. Κάθε πληρωμή σου δίνει πόντους για εκπτώσεις και δώρα.",
        }),
        ctaPrimaryLabel: fields.text({ label: "Κύριο κουμπί", defaultValue: "Γίνε μέλος του Team" }),
        ctaPrimaryHref: fields.text({ label: "Σύνδεσμος κύριου κουμπιού", defaultValue: "#pricing" }),
        ctaSecondaryLabel: fields.text({ label: "Δευτερεύον κουμπί", defaultValue: "Κάνε το quiz 1 λεπτού" }),
        ctaSecondaryHref: fields.text({ label: "Σύνδεσμος δευτερεύοντος κουμπιού", defaultValue: "#pricing" }),
        memberCountLabel: fields.text({ label: "Ένδειξη μελών", defaultValue: "[X]+ μέλη στο Team" }),
        ratingLabel: fields.text({ label: "Ένδειξη βαθμολογίας", defaultValue: "★ [X]/5 από μέλη" }),
        workoutDayLabel: fields.text({ label: "Κάρτα προπόνησης — ημέρα", defaultValue: "ΣΗΜΕΡΑ · ΗΜΕΡΑ 3" }),
        workoutTitle: fields.text({ label: "Κάρτα προπόνησης — τίτλος", defaultValue: "Lower Body — Deadlift" }),
        workoutMeta: fields.text({ label: "Κάρτα προπόνησης — meta", defaultValue: "5 ασκήσεις · 60 λεπτά" }),
        workoutPoints: fields.text({ label: "Κάρτα προπόνησης — πόντοι", defaultValue: "+[X] πόντοι · Συνδρομή Οκτωβρίου" }),
        backgroundImage: imageField("Φωτογραφία φόντου", "/uploads/seed-hero-bg.jpg"),
        backgroundImageAlt: fields.text({ label: "Περιγραφή φωτογραφίας φόντου", defaultValue: "Προπόνηση με βάρη" }),
        showWorkoutCard: fields.checkbox({ label: "Εμφάνιση κάρτας προπόνησης", defaultValue: true }),
        showMemberStats: fields.checkbox({ label: "Εμφάνιση μελών και βαθμολογίας", defaultValue: true }),
      },
    }),
    featuresStrip: singleton({
      label: "Μπάρα Χαρακτηριστικών",
      path: "content/features-strip",
      schema: {
        items: fields.array(
          fields.object({
            title: fields.text({ label: "Τίτλος" }),
            subtitle: fields.text({ label: "Υπότιτλος" }),
          }),
          {
            label: "Χαρακτηριστικά",
            itemLabel: (props) => props.fields.title.value || "Χαρακτηριστικό",
          }
        ),
      },
    }),
    coachProfile: singleton({
      label: "Προφίλ Coach",
      path: "content/coach-profile",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Ο COACH ΣΟΥ" }),
        name: fields.text({ label: "Όνομα (άσπρο)", defaultValue: "ΠΑΝΤΕΛΗΣ" }),
        nameHighlight: fields.text({ label: "Επώνυμο (λαχανί)", defaultValue: "ΣΤΑΥΡΟΥΛΑΚΗΣ" }),
        subtitle: fields.text({
          label: "Υπότιτλος",
          defaultValue: "Αθλητής bodybuilding NPC Worldwide · 4 φορές πρωταθλητής · Ιδρυτής του SP Team",
        }),
        bio: fields.text({
          label: "Βιογραφικό",
          multiline: true,
          defaultValue:
            "Γεια, είμαι ο Παντελής. Από μικρός ζω για το bodybuilding και το fitness — από τις πρώτες μου προπονήσεις μέχρι τη σκηνή των αγώνων. Έφτιαξα το SP Team για να σου δώσω ό,τι δούλεψε για μένα, για τους αθλητές μου και για τους πελάτες μου: ένα πλάνο φτιαγμένο για σένα και κάποιον που σε κρατά συνεπή.",
        }),
        photo: imageField("Φωτογραφία", "/uploads/seed-coach-profile.jpg"),
        competitorBadgeLabel: fields.text({ label: "Ετικέτα κάρτας", defaultValue: "ΑΓΩΝΙΣΤΗΣ" }),
        competitorOrg: fields.text({ label: "Οργανισμός", defaultValue: "NPC Worldwide" }),
        competitorCategory: fields.text({ label: "Κατηγορία", defaultValue: "Bodybuilding · Heavyweight" }),
        videoLabel: fields.text({ label: "Κείμενο βίντεο", defaultValue: "Δες το μήνυμά μου" }),
        videoDuration: fields.text({ label: "Διάρκεια βίντεο", defaultValue: "Βίντεο γνωριμίας · 1:20" }),
        introVideoUrl: fields.url({
          label: "Σύνδεσμος YouTube",
          description: "Επικόλλησε ένα link YouTube — θα ανοίγει σε popup όταν πατηθεί το κουμπί του βίντεο.",
          validation: { isRequired: false },
        }),
        stats: fields.array(statField("[X]+", "Χρόνια εμπειρίας"), {
          label: "Στατιστικά",
          itemLabel: (props) => `${props.fields.value.value} ${props.fields.label.value}`,
        }),
        achievements: fields.array(
          fields.object({
            year: fields.text({ label: "Έτος" }),
            title: fields.text({ label: "Τίτλος" }),
            result: fields.text({ label: "Αποτέλεσμα" }),
          }),
          {
            label: "Διακρίσεις",
            itemLabel: (props) => `${props.fields.year.value} — ${props.fields.title.value}`,
          }
        ),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού", defaultValue: "Δούλεψε μαζί μου" }),
        instagram: fields.url({ label: "Instagram link", validation: { isRequired: false } }),
        youtube: fields.url({ label: "YouTube link", validation: { isRequired: false } }),
        quote: fields.text({ label: "Απόφθεγμα", multiline: true, defaultValue: "Δεν χρειάζεσαι motivation. Χρειάζεσαι" }),
        quoteHighlight: fields.text({ label: "Απόφθεγμα (λαχανί)", defaultValue: "συνέπεια." }),
        quoteAuthor: fields.text({ label: "Υπογραφή αποφθέγματος", defaultValue: "Παντελής Σταυρουλάκης, founder & head coach" }),
      },
    }),
    platformSection: singleton({
      label: "Ενότητα 'Η Πλατφόρμα'",
      path: "content/platform-section",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Η ΠΛΑΤΦΟΡΜΑ" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Όλο σου το πρόγραμμα, στο κινητό σου" }),
        description: fields.text({
          label: "Περιγραφή",
          multiline: true,
          defaultValue:
            "Η σημερινή προπόνηση, τα macros, η πρόοδός σου και τα μηνύματα του Παντελή — οργανωμένα, ώστε να ξέρεις πάντα τι κάνεις σήμερα.",
        }),
        phone1Image: imageField("Φωτογραφία κινητού 1"),
        phone1Label: fields.text({ label: "Ετικέτα κινητού 1", defaultValue: "Πλάνο διατροφής" }),
        phone2Image: imageField("Φωτογραφία κινητού 2 (κεντρική)"),
        phone2Label: fields.text({ label: "Ετικέτα κινητού 2", defaultValue: "Η προπόνησή μου" }),
        phone3Image: imageField("Φωτογραφία κινητού 3"),
        phone3Label: fields.text({ label: "Ετικέτα κινητού 3", defaultValue: "Πρόοδος & ρεκόρ" }),
        features: fields.array(
          fields.object({
            title: fields.text({ label: "Τίτλος" }),
            subtitle: fields.text({ label: "Υπότιτλος" }),
          }),
          {
            label: "Χαρακτηριστικά",
            itemLabel: (props) => props.fields.title.value || "Χαρακτηριστικό",
          }
        ),
      },
    }),
    planSection: singleton({
      label: "Ενότητα 'Πλάνο 360°'",
      path: "content/plan-section",
      schema: {
        heading: fields.text({ label: "Τίτλος", defaultValue: "Ένα πλάνο 360° φτιαγμένο μόνο για σένα" }),
        description: fields.text({
          label: "Περιγραφή",
          multiline: true,
          defaultValue:
            "Η προπόνηση πιάνει όταν είναι φτιαγμένη για σένα. Ο coach σου σχεδιάζει προπόνηση και διατροφή γύρω από τη ζωή σου — και τα προσαρμόζει κάθε εβδομάδα.",
        }),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού", defaultValue: "Ξεκίνα" }),
        sectionBackgroundImage: imageField("Φωτογραφία φόντου", "/uploads/sectionBackgroundImage.webp"),
        clientAvatar: imageField("Avatar παραδείγματος", "/uploads/seed-maria-avatar.jpg"),
        clientName: fields.text({ label: "Όνομα παραδείγματος", defaultValue: "Μαρία" }),
        clientSince: fields.text({ label: "Υπότιτλος παραδείγματος", defaultValue: "Μέλος · 12 εβδομάδες" }),
        programme: fields.array(fields.text({ label: "Γραμμή" }), {
          label: "Πρόγραμμα",
          itemLabel: (props) => props.value || "Γραμμή",
        }),
        nutrition: fields.array(fields.text({ label: "Γραμμή" }), {
          label: "Διατροφή",
          itemLabel: (props) => props.value || "Γραμμή",
        }),
        goals: fields.array(fields.text({ label: "Γραμμή" }), {
          label: "Στόχοι",
          itemLabel: (props) => props.value || "Γραμμή",
        }),
        equipment: fields.array(fields.text({ label: "Γραμμή" }), {
          label: "Εξοπλισμός",
          itemLabel: (props) => props.value || "Γραμμή",
        }),
        history: fields.array(fields.text({ label: "Γραμμή" }), {
          label: "Ιστορικό",
          itemLabel: (props) => props.value || "Γραμμή",
        }),
        pointsNote: fields.array(fields.text({ label: "Γραμμή" }), {
          label: "Πόντοι",
          itemLabel: (props) => props.value || "Γραμμή",
        }),
      },
    }),
    pointsSection: singleton({
      label: "Ενότητα Συστήματος Πόντων",
      path: "content/points-section",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "ΣΥΣΤΗΜΑ ΠΟΝΤΩΝ" }),
        titleLine1: fields.text({ label: "Τίτλος γραμμή 1", defaultValue: "ΜΕΝΕΙΣ." }),
        titleLine2: fields.text({ label: "Τίτλος γραμμή 2", defaultValue: "ΚΕΡΔΙΖΕΙΣ." }),
        description: fields.text({
          label: "Περιγραφή",
          multiline: true,
          defaultValue:
            "Κάθε πληρωμή σου στο SP Team σού δίνει πόντους. Τους μαζεύεις στο πορτοφόλι σου και τους εξαργυρώνεις σε έκπτωση στην επόμενη πληρωμή, 1:1 κλήσεις ή δώρα.",
        }),
        baseRateValue: fields.text({ label: "Βασικός ρυθμός — τιμή", defaultValue: "1€ = [X] pts" }),
        baseRateLabel: fields.text({ label: "Βασικός ρυθμός — ετικέτα", defaultValue: "Σε κάθε μηνιαία πληρωμή" }),
        bonusItems: fields.array(statField("+[X] bonus", "Πακέτο 3 μηνών"), {
          label: "Bonus πόντων",
          itemLabel: (props) => `${props.fields.value.value} — ${props.fields.label.value}`,
        }),
        walletHeading: fields.text({ label: "Τίτλος πορτοφολιού", defaultValue: "Το πορτοφόλι σου" }),
        availablePointsLabel: fields.text({ label: "Ετικέτα διαθέσιμων πόντων", defaultValue: "Διαθέσιμοι πόντοι" }),
        availablePoints: fields.text({ label: "Διαθέσιμοι πόντοι", defaultValue: "[X] pts" }),
        pointsToNextLabel: fields.text({
          label: "Ετικέτα επόμενης έκπτωσης",
          defaultValue: "Ακόμα [X] pts για έκπτωση στην επόμενη πληρωμή",
        }),
        historyItems: fields.array(
          fields.object({
            title: fields.text({ label: "Τίτλος" }),
            subtitle: fields.text({ label: "Υπότιτλος" }),
            amount: fields.text({ label: "Ποσό", defaultValue: "+[X]" }),
          }),
          {
            label: "Ιστορικό πόντων",
            itemLabel: (props) => props.fields.title.value || "Κίνηση",
          }
        ),
        redemptionOptions: fields.array(statField("[X] pts", "Έκπτωση στον επόμενο μήνα"), {
          label: "Επιλογές εξαργύρωσης",
          itemLabel: (props) => props.fields.label.value || "Επιλογή",
        }),
      },
    }),
    servicesIntro: singleton({
      label: "Εισαγωγή Τιμών",
      path: "content/services-intro",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Τιμές" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Απλές τιμές, χωρίς δέσμευση" }),
      },
    }),
    testimonialsIntro: singleton({
      label: "Ενότητα 'Πριν & Μετά'",
      path: "content/testimonials-intro",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "ΠΡΙΝ & ΜΕΤΑ" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Πραγματικοί άνθρωποι, πραγματικά αποτελέσματα" }),
        ratingLabel: fields.text({ label: "Ένδειξη βαθμολογίας", defaultValue: "★ [X]/5 από μέλη" }),
        statLabel: fields.text({ label: "Ένδειξη μεταμορφώσεων", defaultValue: "[X]+ μεταμορφώσεις με το SP Team" }),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού", defaultValue: "Γίνε η επόμενη μεταμόρφωση" }),
        ctaHref: fields.text({ label: "Σύνδεσμος κουμπιού", defaultValue: "#pricing" }),
      },
    }),
    faqSection: singleton({
      label: "Ενότητα 'Συχνές ερωτήσεις'",
      path: "content/faq-section",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "FAQ" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Συχνές ερωτήσεις." }),
        items: fields.array(
          fields.object({
            question: fields.text({ label: "Ερώτηση" }),
            answer: fields.text({ label: "Απάντηση", multiline: true }),
          }),
          {
            label: "Ερωτήσεις",
            itemLabel: (props) => props.fields.question.value || "Ερώτηση",
          }
        ),
      },
    }),
    finalCta: singleton({
      label: "Ενότητα 'Τελικό CTA banner'",
      path: "content/final-cta",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "SP Team" }),
        heading: fields.text({
          label: "Τίτλος",
          multiline: true,
          defaultValue: "Η καλύτερη εκδοχή σου\nξεκινά σήμερα.",
        }),
        bannerImage: imageField("Φωτογραφία φόντου", "/uploads/bannerImage.webp"),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού", defaultValue: "Γίνε μέλος του Team" }),
        ctaHref: fields.text({ label: "Σύνδεσμος κουμπιού", defaultValue: "#pricing" }),
      },
    }),
    termsPage: singleton({
      label: "Σελίδα 'Όροι χρήσης'",
      path: "content/terms-page",
      schema: {
        heading: fields.text({ label: "Τίτλος", defaultValue: "Όροι χρήσης" }),
        content: fields.text({ label: "Κείμενο", multiline: true, defaultValue: "" }),
      },
    }),
    privacyPage: singleton({
      label: "Σελίδα 'Απόρρητο'",
      path: "content/privacy-page",
      schema: {
        heading: fields.text({ label: "Τίτλος", defaultValue: "Πολιτική Απορρήτου" }),
        content: fields.text({ label: "Κείμενο", multiline: true, defaultValue: "" }),
      },
    }),
    cookiesPage: singleton({
      label: "Σελίδα 'Cookies'",
      path: "content/cookies-page",
      schema: {
        heading: fields.text({ label: "Τίτλος", defaultValue: "Πολιτική Cookies" }),
        content: fields.text({ label: "Κείμενο", multiline: true, defaultValue: "" }),
      },
    }),
  },
  collections: {
    pricingPlans: collection({
      label: "Πακέτα & Τιμές",
      path: "content/pricing-plans/*",
      slugField: "name",
      schema: {
        name: fields.slug({ name: { label: "Όνομα πακέτου" } }),
        photo: fields.image({
          label: "Φωτογραφία",
          directory: "public/uploads",
          publicPath: "/uploads/",
          validation: { isRequired: false },
        }),
        badge: fields.text({ label: "Ετικέτα (π.χ. 'Δημοφιλές')", validation: { isRequired: false } }),
        description: fields.text({ label: "Περιγραφή", multiline: true, validation: { isRequired: false } }),
        price: fields.number({ label: "Τιμή (€)", defaultValue: 0 }),
        period: fields.text({ label: "Περίοδος (π.χ. 'μήνα')", defaultValue: "μήνα", validation: { isRequired: false } }),
        features: fields.array(
          fields.object({
            text: fields.text({ label: "Χαρακτηριστικό" }),
            included: fields.checkbox({ label: "Συμπεριλαμβάνεται", defaultValue: true }),
          }),
          {
            label: "Χαρακτηριστικά",
            itemLabel: (props) => props.fields.text.value || "Χαρακτηριστικό",
          }
        ),
        isPopular: fields.checkbox({ label: "Δημοφιλές / προτεινόμενο πακέτο", defaultValue: false }),
        order: fields.integer({ label: "Σειρά εμφάνισης", defaultValue: 0 }),
      },
    }),
    testimonials: collection({
      label: "Πριν & Μετά",
      path: "content/testimonials/*",
      slugField: "name",
      schema: {
        name: fields.slug({ name: { label: "Όνομα πελάτη" } }),
        photo: imageField("Φωτογραφία"),
        statValue: fields.text({ label: "Αποτέλεσμα (π.χ. '−[X] KG', '+[X] KG ΜΥΩΝ', '−[X]% ΛΙΠΟΣ')" }),
        weeksLabel: fields.text({ label: "Διάρκεια", defaultValue: "[X] εβδομάδες" }),
        quote: fields.text({ label: "Μαρτυρία", multiline: true }),
        order: fields.integer({ label: "Σειρά εμφάνισης", defaultValue: 0 }),
      },
    }),
  },
});
