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
        ctaSecondaryHref: fields.text({ label: "Σύνδεσμος δευτερεύοντος κουμπιού", defaultValue: "#contact" }),
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
    expertsSection: singleton({
      label: "Ενότητα 'Φτιαγμένο από ειδικούς'",
      path: "content/experts-section",
      schema: {
        heading: fields.text({ label: "Τίτλος", defaultValue: "Φτιαγμένο από ειδικούς" }),
        description: fields.text({
          label: "Περιγραφή",
          multiline: true,
          defaultValue: "Κάθε πρόγραμμα γράφεται από πιστοποιημένο coach, με βάση τους στόχους, τον χρόνο και τον εξοπλισμό σου.",
        }),
        tags: fields.array(fields.text({ label: "Ετικέτα" }), {
          label: "Ετικέτες",
          itemLabel: (props) => props.value || "Ετικέτα",
        }),
        gallery: fields.array(imageField("Φωτογραφία"), {
          label: "Φωτογραφίες (γκαλερί)",
          itemLabel: () => "Φωτογραφία",
        }),
        discordHeading: fields.text({ label: "Τίτλος κάρτας Discord", defaultValue: "Ποτέ δεν προπονείσαι μόνος" }),
        discordDescription: fields.text({
          label: "Περιγραφή κάρτας Discord",
          multiline: true,
          defaultValue: "Ο coach σου κάνει check-in κάθε εβδομάδα, βλέπει την πρόοδό σου και σε κρατά συνεπή — όλα μέσα από το Discord.",
        }),
        coachChatMessage: fields.text({ label: "Μήνυμα coach (bubble)", defaultValue: "Coach: «Τέλειο set! Συνέχισε έτσι»" }),
        discordBackImage: imageField("Φωτογραφία (πίσω)", "/uploads/seed-discord-back.jpg"),
        discordFrontImage: imageField("Φωτογραφία (μπροστά)", "/uploads/seed-discord-front.jpg"),
      },
    }),
    coachProfile: singleton({
      label: "Προφίλ Coach",
      path: "content/coach-profile",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Ο COACH ΣΟΥ" }),
        name: fields.text({ label: "Όνομα", defaultValue: "ΠΑΝΤΕΛΗΣ ΣΤΑΥΡΟΥΛΑΚΗΣ" }),
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
        quote: fields.text({ label: "Απόφθεγμα", multiline: true, defaultValue: "Δεν χρειάζεσαι motivation. Χρειάζεσαι συνέπεια." }),
        quoteAuthor: fields.text({ label: "Υπογραφή αποφθέγματος", defaultValue: "Παντελής Σταυρουλάκης, founder & head coach" }),
      },
    }),
    directWorkSection: singleton({
      label: "Ενότητα 'Δουλεύεις απευθείας'",
      path: "content/direct-work-section",
      schema: {
        heading: fields.text({ label: "Τίτλος", defaultValue: "Δουλεύεις απευθείας με τον Παντελή" }),
        description: fields.text({
          label: "Περιγραφή",
          multiline: true,
          defaultValue: "Όχι βοηθοί, όχι αυτόματα μηνύματα. Ο ίδιος βλέπει τα check-ins σου και σου απαντά στο Discord.",
        }),
        phoneImage: imageField("Φωτογραφία στο κινητό", "/uploads/seed-phone-mockup.jpg"),
        checkinLabel: fields.text({ label: "Ετικέτα κάρτας check-in", defaultValue: "ΕΒΔΟΜΑΔΙΑΙΟ CHECK-IN" }),
        checkinStats: fields.array(statField("-0,6 kg", "Βάρος"), {
          label: "Στατιστικά check-in",
          itemLabel: (props) => `${props.fields.label.value}: ${props.fields.value.value}`,
        }),
        renewalBadge: fields.text({ label: "Ετικέτα ανανέωσης", defaultValue: "Συνδρομή ανανεώθηκε · +[X] πόντοι" }),
        chatHeading: fields.text({ label: "Όνομα στο chat", defaultValue: "Coach Παντελής" }),
        chatChannel: fields.text({ label: "Κανάλι", defaultValue: "# weekly-check-in" }),
        chatMessage: fields.text({
          label: "Μήνυμα coach",
          multiline: true,
          defaultValue: "Τρομερό squat σήμερα! Ανέβηκες 5kg από την περασμένη εβδομάδα — συνέχισε έτσι.",
        }),
        videoLabel: fields.text({ label: "Ετικέτα βίντεο", defaultValue: "Video feedback · 0:48" }),
        discordLabel: fields.text({ label: "Τίτλος κάρτας Discord", defaultValue: "Μιλάτε στο Discord" }),
        discordSub: fields.text({ label: "Υπότιτλος κάρτας Discord", defaultValue: "Μηνύματα, φωνητικά & video" }),
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
        backgroundImage: imageField("Φωτογραφία φόντου", "/uploads/seed-plan360-bg.jpg"),
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
      label: "Εισαγωγή Testimonials",
      path: "content/testimonials-intro",
      schema: {
        eyebrow: fields.text({ label: "Μικρός τίτλος", defaultValue: "Αποτελέσματα" }),
        heading: fields.text({ label: "Τίτλος", defaultValue: "Τα μέλη μας βλέπουν αποτελέσματα" }),
        ratingLabel: fields.text({ label: "Ένδειξη βαθμολογίας", defaultValue: "★ [X]/5 από μέλη" }),
        statLabel: fields.text({ label: "Ένδειξη στατιστικού", defaultValue: "[X]% λένε ότι είναι πιο συνεπείς μέσα σε 4 εβδομάδες" }),
        ctaLabel: fields.text({ label: "Κείμενο κουμπιού", defaultValue: "Κάνε το quiz 1 λεπτού" }),
        ctaHref: fields.text({ label: "Σύνδεσμος κουμπιού", defaultValue: "#contact" }),
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
    testimonials: collection({
      label: "Testimonials",
      path: "content/testimonials/*",
      slugField: "name",
      schema: {
        name: fields.slug({ name: { label: "Όνομα πελάτη" } }),
        role: fields.text({ label: "Υπότιτλος (π.χ. 'Μέλος εδώ και 6 μήνες')", validation: { isRequired: false } }),
        photo: imageField("Φωτογραφία"),
        quote: fields.text({ label: "Μαρτυρία", multiline: true }),
        rating: fields.integer({ label: "Βαθμολογία (1-5)", defaultValue: 5, validation: { min: 1, max: 5 } }),
        order: fields.integer({ label: "Σειρά εμφάνισης", defaultValue: 0 }),
      },
    }),
  },
});
