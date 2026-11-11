export const defaultUpdateForm = {
  steps: [
    { id: 'weight', title: 'Βάρος', icon: 'scale', questions: [
      { id: 'weight_kg', code: '1.1', shortLabel: 'Βάρος', label: 'Τελευταίο πρωινό βάρος (kg)', type: 'number', unit: 'kg', decimals: 1, showDelta: true, required: true, showToCoach: true, placeholder: 'π.χ. 82,5' },
      { id: 'weight_extra', code: '1.2', shortLabel: 'Βάρος & δραστηριότητα', label: 'Βάρος και δραστηριότητα: επιπλέον στοιχεία', type: 'text', required: false, showToCoach: false, placeholder: 'Μέσο εβδομαδιαίο βάρος, βήματα, αερόβια…' },
    ] },
    { id: 'diet_training', title: 'Διατροφή & προπόνηση', icon: 'apple', questions: [
      { id: 'diet_score', code: '2.1', shortLabel: 'Διατροφή', label: 'Πόσο συνεπής ήσουν στη διατροφή;', type: 'scale', display: 'buttons', scaleLabels: ['Καθόλου', 'Λίγες μέρες', 'Μισές μέρες', 'Σχεδόν πλήρως', 'Πλήρως'], required: true, scored: true, weight: 1, showToCoach: true },
      { id: 'diet_changes', code: '2.1a', shortLabel: 'Αποκλίσεις διατροφής', label: 'Τι άλλαξε από το πλάνο;', help: 'Οι συμφωνημένες αλλαγές δεν μετράνε', type: 'chips', multi: true, withText: true, options: ['Έφαγα έξω', 'Παρέλειψα γεύμα', 'Τσιμπολόγημα', 'Αλκοόλ', 'Άλλαξα ποσότητες'], required: true, showToCoach: true, showIf: { questionId: 'diet_score', op: '<', value: 5 } },
      { id: 'workouts_auto', code: '2.2', shortLabel: 'Προπονήσεις', label: 'Προπονήσεις εβδομάδας', type: 'auto', autoSource: 'workouts_week', required: false, showToCoach: true },
      { id: 'training_score', code: '2.3', shortLabel: 'Πρόγραμμα', label: 'Πόσο συνεπής ήσουν στο πρόγραμμα;', help: 'Η αύξηση δύναμης δεν είναι απαραίτητη για 5', type: 'scale', display: 'buttons', scaleLabels: ['Δεν το εφάρμοσα', 'Λίγο', 'Περίπου μισό', 'Σχεδόν όλο', 'Ολόκληρο'], required: true, scored: true, weight: 1, showToCoach: true },
      { id: 'training_notes', code: '2.4', shortLabel: 'Σχόλια προπόνησης', label: 'Κάτι για την προπόνηση;', type: 'chips', multi: true, withText: true, options: ['Πόνος / ενόχληση', 'Δυσκολία σε άσκηση', 'Έλειψα (υποχρεώσεις)', 'Ένιωσα δυνατός'], required: false, showToCoach: true },
      { id: 'pain_details', code: '2.4a', shortLabel: 'Ενόχληση', label: 'Περίγραψε την ενόχληση', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'training_notes', op: 'includes', value: 'Πόνος / ενόχληση' } },
    ] },
    { id: 'sleep', title: 'Ύπνος & αποκατάσταση', icon: 'moon', questions: [
      { id: 'sleep_hours', code: '3.1', shortLabel: 'Ώρες ύπνου', label: 'Πόσες ώρες κοιμόσουν κατά μέσο όρο;', type: 'chips', multi: false, options: ['<5', '5–6', '6–7', '7–8', '8+'], required: true, showToCoach: true },
      { id: 'sleep_quality', code: '3.2', shortLabel: 'Ποιότητα ύπνου', label: 'Ποιότητα ύπνου', type: 'scale', display: 'buttons', scaleLabels: ['Πολύ κακή', 'Κακή', 'Μέτρια', 'Καλή', 'Πολύ καλή'], required: true, scored: true, weight: 1, showToCoach: true },
      { id: 'recovery', code: '3.3', shortLabel: 'Αποκατάσταση', label: 'Πώς ήταν η αποκατάστασή σου;', type: 'scale', display: 'buttons', scaleLabels: ['Πολύ κακή', 'Κακή', 'Μέτρια', 'Καλή', 'Πολύ καλή'], required: true, scored: true, weight: 1, showToCoach: true },
      { id: 'recovery_notes', code: '3.3a', shortLabel: 'Σημειώσεις αποκατάστασης', label: 'Τι σε επηρέασε περισσότερο;', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'recovery', op: '<=', value: 2 } },
    ] },
    { id: 'health_week', title: 'Υγεία & εβδομάδα', icon: 'heart', questions: [
      { id: 'health_changed', code: '4.1', shortLabel: 'Αλλαγή υγείας', label: 'Υπήρξε αλλαγή στην υγεία σου;', type: 'yes_no', required: true, showToCoach: true },
      { id: 'health_details', code: '4.1a', shortLabel: 'Λεπτομέρειες υγείας', label: 'Διευκρίνισε την αλλαγή στην υγεία', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'health_changed', op: 'is', value: true } },
      { id: 'next_week', code: '4.2', shortLabel: 'Επόμενη εβδομάδα', label: 'Τι χρειάζεσαι για την επόμενη εβδομάδα;', type: 'chips', multi: true, withText: true, options: ['Ταξίδι', 'Βάρδιες', 'Εκδήλωση', 'Λιγότερος χρόνος', 'Τίποτα'], required: true, showToCoach: true },
    ] },
    { id: 'photos', title: 'Φωτογραφίες', icon: 'camera', questions: [
      { id: 'progress_photos', code: '5.1', shortLabel: 'Φωτογραφίες', label: 'Ανέβασε τις φωτογραφίες σου', help: 'Ίδιο φως, απόσταση και στάση · χωρίς φίλτρα', type: 'photos', photoSlots: ['Μπροστά', 'Πλάι', 'Πίσω'], required: false, showToCoach: true },
      { id: 'coach_note', code: '5.2', shortLabel: 'Σημείωση', label: 'Κάτι άλλο για τον coach;', type: 'text', required: false, showToCoach: true },
    ] },
  ],
  scoreTiers: [
    { min: 90, max: 100, title: 'Εξαιρετική εβδομάδα!', message: 'Συνέπεια σε όλα. Συνέχισε ακριβώς έτσι.' },
    { min: 75, max: 89, title: 'Πολύ καλή εβδομάδα', message: 'Είσαι σε πολύ καλό δρόμο. Μικρές βελτιώσεις φέρνουν το επόμενο βήμα.' },
    { min: 60, max: 74, title: 'Καλή βάση', message: 'Υπάρχουν σημεία να δουλέψουμε. Ο coach θα σου δώσει συγκεκριμένη κατεύθυνση.' },
    { min: 40, max: 59, title: 'Εβδομάδα με δυσκολίες', message: 'Συμβαίνει. Θα δούμε μαζί τι σε δυσκόλεψε και πώς το προσαρμόζουμε.' },
    { min: 0, max: 39, title: 'Δύσκολη εβδομάδα', message: 'Μην αγχώνεσαι. Γράψε στον coach σου τι χρειάζεσαι για την επόμενη εβδομάδα.' },
  ],
  scoreNote: 'Το σκορ βοηθά την αξιολόγηση. Η τελική καθοδήγηση λαμβάνει υπόψη τις απαντήσεις σου, την πρόοδο και τις συνθήκες της εβδομάδας.',
  settings: { deadlineTime: '23:59', allowedDays: [1, 2, 3, 4, 5, 6], photosRequired: false, showScoreToClient: true },
};
