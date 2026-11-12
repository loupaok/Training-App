export const defaultUpdateForm = {
  steps: [
    { id: 'diet_training', title: 'Διατροφή & προπόνηση', icon: 'apple', questions: [
      { id: 'diet_score', code: '1.1', shortLabel: 'Διατροφή', label: 'Πόσο συνεπής ήσουν στη διατροφή σου;', help: 'Επίλεξε από 1 έως 5.', type: 'scale', display: 'buttons', scaleLabels: ['Δεν το ακολούθησα ουσιαστικά.', 'Το ακολούθησα σε λίγες ημέρες.', 'Το ακολούθησα περίπου τις μισές ημέρες.', 'Το ακολούθησα σχεδόν πλήρως, με μικρές αποκλίσεις.', 'Ακολούθησα πλήρως το συμφωνημένο πλάνο.'], required: true, scored: true, weight: 2, showToCoach: true },
      { id: 'diet_changes', code: '1.1a', shortLabel: 'Αποκλίσεις διατροφής', label: 'Αν υπήρξαν αποκλίσεις, τι άλλαξε από το πλάνο;', help: 'Τι έφαγες εκτός πλάνου; Παρέλειψες κάποιο γεύμα ή άλλαξες ποσότητες; Ποιο γεύμα, πόσες φορές και για ποιον λόγο; Οι αλλαγές που έχουμε ήδη συμφωνήσει μαζί δεν θεωρούνται αποκλίσεις.', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'diet_score', op: '<', value: 5 } },
      { id: 'training_planned_completed', code: '1.2', shortLabel: 'Προπονήσεις', label: 'Πόσες προπονήσεις είχες στο πρόγραμμα και πόσες ολοκλήρωσες;', type: 'text', required: true, showToCoach: true, placeholder: 'π.χ. 4 προγραμματισμένες · 3 ολοκληρωμένες' },
      { id: 'training_missed_reason', code: '1.3', shortLabel: 'Χαμένες προπονήσεις', label: 'Αν έχασες κάποια προπόνηση, γιατί;', type: 'text', required: false, showToCoach: true },
      { id: 'training_progress', code: '1.4', shortLabel: 'Πρόοδος προπόνησης', label: 'Υπήρξε πρόοδος σε κιλά, επαναλήψεις ή τεχνική; Σε ποιες ασκήσεις;', type: 'text', required: false, showToCoach: true },
      { id: 'training_pain', code: '1.5', shortLabel: 'Δυσκολία ή πόνος', label: 'Σε δυσκόλεψε κάτι ή εμφανίστηκε πόνος;', type: 'text', required: false, showToCoach: true },
      { id: 'training_score', code: '1.6', shortLabel: 'Εφαρμογή προγράμματος', label: 'Πόσο συνεπής ήσουν στην εφαρμογή της προπόνησης;', help: 'Η αύξηση δύναμης δεν είναι απαραίτητη κάθε εβδομάδα για να επιλέξεις 5.', type: 'scale', display: 'buttons', scaleLabels: ['Δεν το εφάρμοσα.', 'Ολοκλήρωσα μικρό μέρος.', 'Ολοκλήρωσα περίπου το μισό.', 'Το ολοκλήρωσα σχεδόν όλο.', 'Ολοκλήρωσα το συμφωνημένο πρόγραμμα.'], required: true, scored: true, weight: 1, showToCoach: true },
    ] },
    { id: 'weight_activity', title: 'Βάρος & δραστηριότητα', icon: 'scale', questions: [
      { id: 'weight_kg', code: '2.1', shortLabel: 'Τελευταίο βάρος', label: 'Τελευταίο πρωινό βάρος', type: 'number', unit: 'kg', decimals: 1, showDelta: true, required: true, showToCoach: true, placeholder: 'π.χ. 82,5' },
      { id: 'weight_date', code: '2.1a', shortLabel: 'Ημερομηνία βάρους', label: 'Ημερομηνία μέτρησης βάρους', type: 'text', required: true, showToCoach: true, placeholder: 'π.χ. 12/11/2026' },
      { id: 'average_weekly_weight', code: '2.2', shortLabel: 'Μέσο βάρος', label: 'Μέσο εβδομαδιαίο βάρος, αν υπάρχουν καταγραφές', type: 'number', unit: 'kg', decimals: 1, required: false, showToCoach: true },
      { id: 'average_steps', code: '2.3', shortLabel: 'Βήματα', label: 'Μέσος αριθμός βημάτων, αν καταγράφεις', type: 'number', unit: 'βήματα', required: false, showToCoach: true },
      { id: 'cardio_completed', code: '2.4', shortLabel: 'Αερόβια', label: 'Αερόβια που ολοκλήρωσες σε σχέση με την προγραμματισμένη', type: 'text', required: false, showToCoach: true },
    ] },
    { id: 'sleep_recovery', title: 'Ύπνος & αποκατάσταση', icon: 'moon', questions: [
      { id: 'sleep_hours', code: '3.1', shortLabel: 'Ώρες ύπνου', label: 'Πόσες ώρες κοιμόσουν κατά μέσο όρο;', type: 'number', unit: 'ώρες', decimals: 1, required: true, showToCoach: true },
      { id: 'sleep_bad_nights', code: '3.2', shortLabel: 'Κακός ύπνος', label: 'Πόσες νύχτες είχες κακό ύπνο και τι τον επηρέασε;', type: 'text', required: false, showToCoach: true },
      { id: 'sleep_quality', code: '3.3', shortLabel: 'Ποιότητα ύπνου', label: 'Ποιότητα ύπνου', help: 'Βαθμολόγησε από 1 έως 5.', type: 'scale', display: 'buttons', scaleLabels: ['Πολύ κακή', 'Κακή', 'Μέτρια', 'Καλή', 'Πολύ καλή'], required: true, scored: true, weight: 1, showToCoach: true },
      { id: 'recovery', code: '3.4', shortLabel: 'Αποκατάσταση', label: 'Πώς ήταν η αποκατάστασή σου;', help: 'Βαθμολόγησε από 1 έως 5.', type: 'scale', display: 'buttons', scaleLabels: ['Πολύ κακή', 'Κακή', 'Μέτρια', 'Καλή', 'Πολύ καλή'], required: true, scored: true, weight: 1, showToCoach: true },
      { id: 'recovery_notes', code: '3.5', shortLabel: 'Ετοιμότητα', label: 'Ένιωθες έτοιμος για την επόμενη προπόνηση; Αν όχι, τι σε επηρέασε περισσότερο;', help: 'Κόπωση, πιάσιμο, ύπνος, στρες, εργασία ή κάτι άλλο.', type: 'text', required: false, showToCoach: true },
    ] },
    { id: 'health_next_week', title: 'Υγεία & επόμενη εβδομάδα', icon: 'heart', questions: [
      { id: 'health_changed', code: '4.1', shortLabel: 'Αλλαγή υγείας', label: 'Υπήρξε αλλαγή στην υγεία σου;', help: 'Νέος τραυματισμός, ασθένεια, επίμονος πόνος, αλλαγή φαρμακευτικής αγωγής ή νέα οδηγία γιατρού;', type: 'yes_no', required: true, showToCoach: true },
      { id: 'health_details', code: '4.1a', shortLabel: 'Διευκρίνιση υγείας', label: 'Διευκρίνισε την αλλαγή στην υγεία σου', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'health_changed', op: 'is', value: true } },
      { id: 'next_week', code: '4.2', shortLabel: 'Επόμενη εβδομάδα', label: 'Τι χρειάζεσαι για την επόμενη εβδομάδα;', help: 'Ποια ήταν η μεγαλύτερη δυσκολία σου; Υπάρχει ταξίδι, βάρδια ή άλλη υποχρέωση που χρειάζεται να λάβουμε υπόψη;', type: 'text', required: true, showToCoach: true },
    ] },
    { id: 'photos', title: 'Φωτογραφίες', icon: 'camera', questions: [
      { id: 'progress_photos', code: '5.1', shortLabel: 'Φωτογραφίες προόδου', label: 'Ανέβασε τις φωτογραφίες σου εδώ', help: 'Μπροστά, πλάι και πίσω, με ίδιο φωτισμό, απόσταση και στάση όπως στις προηγούμενες φωτογραφίες, χωρίς φίλτρα. Αν έχουμε συμφωνήσει άλλον τρόπο παρακολούθησης, ακολούθησε εκείνες τις οδηγίες.', type: 'photos', photoSlots: ['Μπροστά', 'Πλάι', 'Πίσω'], required: false, showToCoach: true },
    ] },
  ],
  scoreTiers: [
    { min: 90, max: 100, title: 'Εξαιρετική εβδομάδα!', message: 'Συνέχισε έτσι — η συνέπειά σου φαίνεται.' },
    { min: 75, max: 89, title: 'Πολύ καλή εβδομάδα', message: 'Είσαι σε πολύ καλό δρόμο.' },
    { min: 60, max: 74, title: 'Καλή βάση', message: 'Υπάρχουν σημεία που μπορούμε να βελτιώσουμε μαζί.' },
    { min: 40, max: 59, title: 'Εβδομάδα με δυσκολίες', message: 'Θα δούμε μαζί τι χρειάζεται προσαρμογή.' },
    { min: 0, max: 39, title: 'Δύσκολη εβδομάδα', message: 'Μην αγχώνεσαι — γράψε στον coach σου τι χρειάζεσαι.' },
  ],
  scoreNote: 'Το σκορ βοηθά την αξιολόγηση. Η τελική καθοδήγηση λαμβάνει υπόψη τις απαντήσεις σου, την πρόοδο και τις συνθήκες της εβδομάδας.',
  settings: { deadlineTime: '23:59', allowedDays: [1, 2, 3, 4, 5, 6], photosRequired: false, showScoreToClient: true },
};
