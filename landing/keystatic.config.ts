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
        siteName: fields.text({ label: "Όνομα εταιρίας", defaultValue: "SP Team" }),
        logoBlack: imageField("Λογότυπο (σκούρο, για ανοιχτό φόντο)", "/uploads/seed-logo-black.svg"),
        logoWhite: imageField("Λογότυπο (λευκό, για σκούρο φόντο)", "/uploads/seed-logo-white.svg"),
        tagline: fields.text({ label: "Σύνθημα (tagline)", defaultValue: "Consistency creates results" }),
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
        loginLabel: fields.text({ label: "Κείμενο 'Σύνδεση'", defaultValue: "Σύνδεση" }),
        loginHref: fields.text({ label: "Σύνδεσμος 'Σύνδεση'", defaultValue: "/login" }),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού header", defaultValue: "Ξεκίνα" }),
        ctaHref: fields.text({ label: "Σύνδεσμος κουμπιού header", defaultValue: "#pricing" }),
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
          defaultValue: "Η συνέπεια φέρνει αποτέλεσμα — προσωπικό coaching, πλάνο προπόνησης & διατροφής από την ομάδα SP Team.",
        }),
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
    allInOneSection: singleton({
      label: "Ενότητα 'Όλα σε ένα σημείο'",
      path: "content/all-in-one-section",
      schema: {
        heading: fields.text({ label: "Τίτλος", defaultValue: "Όλα όσα χρειάζεσαι, σε ένα σημείο" }),
        description: fields.text({
          label: "Περιγραφή",
          multiline: true,
          defaultValue: "Προπόνηση, διατροφή και check-ins οργανωμένα, ώστε να ξέρεις πάντα τι κάνεις σήμερα.",
        }),
        trainingTitle: fields.text({ label: "Προπόνηση — τίτλος", defaultValue: "Προπόνηση" }),
        trainingDescription: fields.text({
          label: "Προπόνηση — περιγραφή",
          multiline: true,
          defaultValue: "Πρόγραμμα με βίντεο εκτέλεσης, sets, κιλά και progressive overload κάθε εβδομάδα.",
        }),
        trainingDayLabel: fields.text({ label: "Προπόνηση — ετικέτα ημέρας", defaultValue: "Ημέρα 3 · Push" }),
        trainingExercises: fields.array(
          fields.object({
            name: fields.text({ label: "Άσκηση" }),
            sets: fields.text({ label: "Sets" }),
          }),
          {
            label: "Προπόνηση — ασκήσεις",
            itemLabel: (props) => props.fields.name.value || "Άσκηση",
          }
        ),
        trainingCtaLabel: fields.text({ label: "Προπόνηση — κουμπί", defaultValue: "Ξεκίνα προπόνηση" }),
        nutritionTitle: fields.text({ label: "Διατροφή — τίτλος", defaultValue: "Διατροφή" }),
        nutritionDescription: fields.text({
          label: "Διατροφή — περιγραφή",
          multiline: true,
          defaultValue: "Macros και γεύματα με ελληνικά φαγητά, λίστα αγορών και εύκολες εναλλακτικές.",
        }),
        nutritionPhoto: imageField("Διατροφή — φωτογραφία", "/uploads/seed-food-prep.jpg"),
        nutritionMacros: fields.array(statField("[X]g", "Πρωτεΐνη"), {
          label: "Διατροφή — macros",
          itemLabel: (props) => `${props.fields.value.value} ${props.fields.label.value}`,
        }),
        checkinsTitle: fields.text({ label: "Check-ins — τίτλος", defaultValue: "Check-ins στο Discord" }),
        checkinsDescription: fields.text({
          label: "Check-ins — περιγραφή",
          multiline: true,
          defaultValue: "Εβδομαδιαίος απολογισμός με τον coach σου και προσαρμογές όπου χρειάζεται.",
        }),
        checkinsQuestion: fields.text({ label: "Check-ins — ερώτηση coach", defaultValue: "Πώς πήγε η εβδομάδα; Στείλε φωτό και βάρος" }),
        checkinsReplyClient: fields.text({ label: "Check-ins — απάντηση πελάτη", defaultValue: "Έκανα και τις 4 προπονήσεις! −0,6 kg" }),
        checkinsReplyCoach: fields.text({ label: "Check-ins — απάντηση coach", defaultValue: "Τέλεια. Ανεβάζουμε λίγο τους υδατάνθρακες." }),
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
        subheading: fields.text({ label: "Υπότιτλος", multiline: true, defaultValue: "Άλλαξε ή ακύρωσε όποτε θες." }),
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
        role: fields.text({ label: "Πλάνο (π.χ. 'Coaching', 'Premium 1:1')", validation: { isRequired: false } }),
        beforeImage: imageField("Φωτογραφία (ΠΡΙΝ)"),
        afterImage: imageField("Φωτογραφία (ΜΕΤΑ)"),
        statValue: fields.text({ label: "Αποτέλεσμα (π.χ. '−[X] KG', '+[X] KG ΜΥΩΝ', '−[X]% ΛΙΠΟΣ')" }),
        weeksLabel: fields.text({ label: "Διάρκεια", defaultValue: "[X] εβδομάδες" }),
        quote: fields.text({ label: "Μαρτυρία", multiline: true }),
        order: fields.integer({ label: "Σειρά εμφάνισης", defaultValue: 0 }),
      },
    }),
  },
});
