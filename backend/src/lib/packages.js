export const PACKAGE_DURATION_SEED = [
  { months: 1, basePriceCents: 10500, label: null, sortOrder: 1 },
  { months: 2, basePriceCents: 19000, label: null, sortOrder: 2 },
  { months: 3, basePriceCents: 27000, label: 'Δημοφιλές', sortOrder: 3 },
  { months: 4, basePriceCents: 35000, label: 'Καλύτερη τιμή', sortOrder: 4 },
]

export const PACKAGE_SEED = [
  { key: 'BASIC', name: 'Βασικό', monthlyAddonCents: 0, label: null, sortOrder: 1, features: ['Εξατομικευμένο πρόγραμμα προπόνησης', 'Διατροφικό πλάνο & καθοδήγηση για συμπληρώματα', '4 updates τον μήνα με αξιολόγηση', 'Έλεγχος έως 4 βίντεο ασκήσεων / εβδομάδα', 'Επικοινωνία στην εφαρμογή · απάντηση σε 2 εργάσιμες'] },
  { key: 'PLUS', name: 'Plus', monthlyAddonCents: 3500, label: 'Δημοφιλές', sortOrder: 2, features: ['2 προσωπικές βιντεοκλήσεις 15΄ / μήνα', 'Προτεραιότητα στην αξιολόγηση 1 - 2 εργάσιμες', 'Απάντηση εντός 1 εργάσιμης'] },
  { key: 'PREMIUM', name: 'Premium', monthlyAddonCents: 6000, label: null, sortOrder: 3, features: ['4 βιντεοκλήσεις 15΄ / μήνα αντί για 2', 'Περισσότερος χρόνος για πρόοδο & στόχους'] },
  { key: 'DIRECT', name: 'Direct', monthlyAddonCents: 10000, label: 'Πλήρης πρόσβαση', sortOrder: 4, features: ['Προσωπικό WhatsApp με τον coach', 'Απάντηση εντός 1 εργάσιμης, στο συμφωνημένο ωράριο'] },
]

export const COMMON_FEATURE_SEED = [
  'Αρχική αξιολόγηση στόχων, φυσικής κατάστασης, εμπειρίας και καθημερινότητας.',
  'Εξατομικευμένο πρόγραμμα προπόνησης, με έμφαση στα σημεία που χρειάζονται ανάπτυξη.',
  'Διατροφικό πλάνο και καθοδήγηση προσαρμοσμένα στις ανάγκες και στις προτιμήσεις σου.',
  'Καθοδήγηση σχετικά με τα συμπληρώματα, όπου υπάρχει λόγος χρήσης.',
  'Τέσσερα προγραμματισμένα updates τον μήνα, με αξιολόγηση φωτογραφιών, μετρήσεων, προπόνησης και εφαρμογής του πλάνου.',
  'Προσαρμογές στο διατροφικό πλάνο όταν προκύπτει ανάγκη από την αξιολόγηση.',
  'Επανεκτίμηση του προπονητικού προγράμματος στις 6–8 εβδομάδες, με νωρίτερες προσαρμογές όπου χρειάζονται.',
  'Έλεγχος έως τεσσάρων βίντεο ασκήσεων την εβδομάδα, με διορθώσεις τεχνικής.',
  'Μηνιαία ανασκόπηση προόδου και πρόσβαση στο σύστημα πόντων επιβράβευσης.',
  'Επικοινωνία μέσα από την εφαρμογή, με απάντηση εντός δύο εργάσιμων ημερών.',
]

export function calculatePackagePriceCents({ basePriceCents, monthlyAddonCents = 0, months }) {
  return Number(basePriceCents) + Number(monthlyAddonCents) * Number(months)
}

export function calculateDurationDiscount(basePriceCents, oneMonthBasePriceCents, months) {
  if (Number(months) <= 1 || !Number(oneMonthBasePriceCents)) return 0
  return Math.round((1 - Number(basePriceCents) / (Number(oneMonthBasePriceCents) * Number(months))) * 100)
}

export function calculateDurationSavingCents(basePriceCents, oneMonthBasePriceCents, months) {
  return Number(oneMonthBasePriceCents) * Number(months) - Number(basePriceCents)
}
