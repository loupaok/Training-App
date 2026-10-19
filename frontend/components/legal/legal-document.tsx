import Link from "next/link";

const businessName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || "Η υπηρεσία coaching";
const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || "support@example.com";

export function LegalDocument({ type }: { type: "privacy" | "terms" }) {
  const privacy = type === "privacy";
  const title = privacy ? "Πολιτική Απορρήτου" : "Όροι Χρήσης";

  return <main className="min-h-screen bg-muted/30 px-4 py-10 sm:px-6 lg:py-16">
    <article className="mx-auto max-w-3xl rounded-xl border bg-card p-6 shadow-sm sm:p-10">
      <Link href="/register" className="text-sm font-semibold text-primary hover:underline">Επιστροφή στην εγγραφή</Link>
      <h1 className="mt-6 text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Τελευταία ενημέρωση: 19 Οκτωβρίου 2026</p>
      {privacy ? <PrivacyContent /> : <TermsContent />}
      <section className="mt-10 border-t pt-6 text-sm text-muted-foreground">
        <p>Υπεύθυνος υπηρεσίας: {businessName}</p>
        <p className="mt-1">Επικοινωνία για θέματα δεδομένων: <a className="font-medium text-primary hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
      </section>
    </article>
  </main>;
}

function PrivacyContent() {
  return <div className="mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
    <section><h2 className="text-lg font-semibold text-foreground">Δεδομένα που επεξεργαζόμαστε</h2><p>Στοιχεία λογαριασμού και επικοινωνίας, στοιχεία σώματος και στόχων, απαντήσεις ερωτηματολογίων, προγράμματα, ενημερώσεις προόδου, φωτογραφίες ή αρχεία που επιλέγεις να ανεβάσεις, καθώς και στοιχεία πληρωμής ή συνδρομής.</p></section>
    <section><h2 className="text-lg font-semibold text-foreground">Γιατί τα χρησιμοποιούμε</h2><p>Για τη δημιουργία και παροχή εξατομικευμένης υπηρεσίας coaching, την επικοινωνία με τον coach, την ασφάλεια του λογαριασμού, την υποστήριξη, την εκπλήρωση νόμιμων υποχρεώσεων και την προστασία από κακόβουλη χρήση.</p></section>
    <section><h2 className="text-lg font-semibold text-foreground">Κοινοποίηση και αποθήκευση</h2><p>Τα δεδομένα είναι διαθέσιμα μόνο στον εξουσιοδοτημένο coach, διαχειριστές με σχετική πρόσβαση και στους τεχνικούς παρόχους που είναι απαραίτητοι για τη λειτουργία της υπηρεσίας, όπως hosting, email, πληρωμές και push notifications. Δεν πωλούμε προσωπικά δεδομένα.</p></section>
    <section><h2 className="text-lg font-semibold text-foreground">Δικαιώματά σου</h2><p>Μπορείς να ζητήσεις πρόσβαση, διόρθωση, εξαγωγή ή διαγραφή των δεδομένων σου, όπου αυτό επιτρέπεται από τον νόμο. Για ευαίσθητα στοιχεία υγείας και φωτογραφίες προόδου, επικοινώνησε με τον υπεύθυνο της υπηρεσίας.</p></section>
  </div>;
}

function TermsContent() {
  return <div className="mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
    <section><h2 className="text-lg font-semibold text-foreground">Χρήση υπηρεσίας</h2><p>Χρησιμοποίησε την εφαρμογή μόνο με ακριβή στοιχεία και κράτησε τα credentials σου εμπιστευτικά. Δεν επιτρέπεται η μη εξουσιοδοτημένη πρόσβαση, η αντιγραφή περιεχομένου ή η χρήση που επηρεάζει την ασφάλεια της υπηρεσίας.</p></section>
    <section><h2 className="text-lg font-semibold text-foreground">Προγράμματα coaching</h2><p>Το περιεχόμενο παρέχεται για coaching και ενημερωτικούς σκοπούς. Δεν αντικαθιστά ιατρική διάγνωση ή συμβουλή. Για τραυματισμό, πάθηση, εγκυμοσύνη ή άλλο θέμα υγείας, συμβουλέψου κατάλληλο επαγγελματία υγείας.</p></section>
    <section><h2 className="text-lg font-semibold text-foreground">Συνδρομές και λογαριασμός</h2><p>Η πρόσβαση στα προγράμματα εξαρτάται από την κατάσταση της συνδρομής και τις διαδικασίες έγκρισης που εφαρμόζει ο coach. Η υπηρεσία μπορεί να ανανεώνει ή να αλλάζει λειτουργίες για λόγους ασφάλειας και βελτίωσης.</p></section>
  </div>;
}
