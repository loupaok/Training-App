// The monthly review deliberately uses the same FormDefinition shape as the
// weekly update. Step one is rendered from the cycle snapshot, not answers.
const satisfactionLabels = ['Καθόλου', 'Λίγο', 'Μέτρια', 'Αρκετά', 'Πολύ'];

export const defaultMonthlyReviewForm = {
  kind: 'monthly',
  steps: [
    { id: 'cycle_progress', title: 'Η πρόοδός σου', icon: 'trending-up', questions: [] },
    { id: 'satisfaction', title: 'Ικανοποίηση', icon: 'heart', questions: [
      { id: 'training_satisfaction', code: '2.1', shortLabel: 'Προπονητικό πλάνο', label: 'Πόσο ικανοποιημένος είσαι από το προπονητικό πλάνο;', type: 'scale', display: 'buttons', scaleLabels: satisfactionLabels, required: true, showToCoach: true },
      { id: 'training_satisfaction_comment', code: '2.1a', shortLabel: 'Σχόλιο προπόνησης', label: 'Σχόλιο για το προπονητικό πλάνο', type: 'text', placeholder: 'Προαιρετικό σχόλιο…', required: false, showToCoach: true, showIf: { questionId: 'training_satisfaction', op: '<=', value: 3 } },
      { id: 'nutrition_satisfaction', code: '2.2', shortLabel: 'Διατροφικό πλάνο', label: 'Πόσο ικανοποιημένος είσαι από το διατροφικό πλάνο;', type: 'scale', display: 'buttons', scaleLabels: satisfactionLabels, required: true, showToCoach: true },
      { id: 'nutrition_satisfaction_comment', code: '2.2a', shortLabel: 'Σχόλιο διατροφής', label: 'Σχόλιο για το διατροφικό πλάνο', type: 'text', placeholder: 'Προαιρετικό σχόλιο…', required: false, showToCoach: true, showIf: { questionId: 'nutrition_satisfaction', op: '<=', value: 3 } },
      { id: 'consistency_satisfaction', code: '2.3', shortLabel: 'Δική σου συνέπεια', label: 'Πόσο ικανοποιημένος είσαι από τη δική σου συνέπεια;', type: 'scale', display: 'buttons', scaleLabels: satisfactionLabels, required: true, showToCoach: true },
      { id: 'consistency_satisfaction_comment', code: '2.3a', shortLabel: 'Σχόλιο συνέπειας', label: 'Σχόλιο για τη συνέπειά σου', type: 'text', placeholder: 'Προαιρετικό σχόλιο…', required: false, showToCoach: true, showIf: { questionId: 'consistency_satisfaction', op: '<=', value: 3 } },
      { id: 'communication_satisfaction', code: '2.4', shortLabel: 'Επικοινωνία & καθοδήγηση', label: 'Πώς αξιολογείς την επικοινωνία και καθοδήγηση;', type: 'chips', options: ['Πλήρως', 'Σε μεγάλο βαθμό', 'Μερικώς', 'Χρειάζομαι περισσότερη υποστήριξη'], required: true, showToCoach: true },
      { id: 'communication_satisfaction_comment', code: '2.4a', shortLabel: 'Σχόλιο επικοινωνίας', label: 'Σχόλιο για την επικοινωνία και καθοδήγηση', type: 'text', placeholder: 'Προαιρετικό σχόλιο…', required: false, showToCoach: true, showIf: { questionId: 'communication_satisfaction', op: 'includes', value: 'Μερικώς' } },
    ] },
    { id: 'goal_focus', title: 'Στόχος & εστίαση', icon: 'target', questions: [
      { id: 'goal_unchanged', code: '3.1', shortLabel: 'Ίδιος στόχος', label: 'Παραμένει ίδιος ο βασικός σου στόχος;', type: 'yes_no', required: true, showToCoach: true },
      { id: 'new_goal', code: '3.1a', shortLabel: 'Νέος στόχος', label: 'Ποιος είναι ο νέος στόχος;', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'goal_unchanged', op: 'is', value: false } },
      { id: 'goal_deadline', code: '3.1b', shortLabel: 'Προθεσμία στόχου', label: 'Προθεσμία (αν υπάρχει)', type: 'text', required: false, showToCoach: true, showIf: { questionId: 'goal_unchanged', op: 'is', value: false } },
      { id: 'training_focus', code: '3.2', shortLabel: 'Εστίαση προπόνησης', label: 'Πού θα ήθελες να εστιάσουμε στην προπόνηση;', help: 'Διάλεξε όσα θέλεις', type: 'chips', options: ['Τεχνική', 'Δύναμη', 'Μυϊκές ομάδες', 'Διάρκεια', 'Ωράριο', 'Άλλο'], multi: true, withText: true, required: true, showToCoach: true },
      { id: 'nutrition_focus', code: '3.3', shortLabel: 'Εστίαση διατροφής', label: 'Πού θα ήθελες να εστιάσουμε στη διατροφή;', help: 'Διάλεξε όσα θέλεις', type: 'chips', options: ['Περισσότερες επιλογές', 'Ευκολότερα γεύματα', 'Πείνα', 'Γεύματα έξω', 'Σαββατοκύριακα', 'Άλλο'], multi: true, withText: true, required: true, showToCoach: true },
      { id: 'next_cycle_priority', code: '3.4', shortLabel: 'Προτεραιότητα επόμενου κύκλου', label: 'Ποια είναι η μία βασική προτεραιότητα για τον επόμενο κύκλο;', type: 'text', required: true, showToCoach: true },
    ] },
    { id: 'changes', title: 'Δυσκολίες & αλλαγές', icon: 'message-circle', questions: [
      { id: 'main_progress', code: '4.1', shortLabel: 'Σημαντικότερη πρόοδος', label: 'Ποια θεωρείς τη σημαντικότερη πρόοδό σου αυτόν τον μήνα;', help: 'Σώμα, δύναμη, τεχνική, ενέργεια ή κάποια συνήθεια.', type: 'text', required: false, showToCoach: true },
      { id: 'main_difficulty', code: '4.2', shortLabel: 'Δυσκολία & βοήθεια', label: 'Τι σε δυσκόλεψε περισσότερο και τι θα σε βοηθούσε;', type: 'text', required: false, showToCoach: true },
      { id: 'life_changed', code: '4.3', shortLabel: 'Αλλαγή υγείας ή καθημερινότητας', label: 'Υπάρχει αλλαγή στην υγεία, στην καθημερινότητα ή στις υποχρεώσεις σου;', type: 'yes_no', required: true, showToCoach: true },
      { id: 'life_changed_details', code: '4.3a', shortLabel: 'Διευκρίνιση αλλαγής', label: 'Διευκρίνισε την αλλαγή', type: 'text', required: true, showToCoach: true, showIf: { questionId: 'life_changed', op: 'is', value: true } },
      { id: 'other_discussion', code: '4.4', shortLabel: 'Κάτι άλλο', label: 'Υπάρχει κάτι άλλο που θέλεις να συζητήσουμε;', type: 'text', required: false, showToCoach: true },
    ] },
  ],
  scoreTiers: [],
  scoreNote: '',
  settings: { deadlineTime: '23:59', allowedDays: [1, 2, 3, 4, 5, 6], photosRequired: false, showScoreToClient: false, dueDays: 5, reminderDaysBeforeDue: 2 },
};
