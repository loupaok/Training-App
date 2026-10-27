# SP Team — Ροή προπόνησης κινητού: checklist υλοποίησης

Πηγή αλήθειας: `C:\Users\loupa\Downloads\workout-reference.html` και `C:\Users\loupa\Downloads\workout-spec.md`.

Κατάσταση: **πριν την επανυλοποίηση**. Κανένα κουτάκι δεν θεωρείται ολοκληρωμένο χωρίς οπτική και λειτουργική επαλήθευση στα 390×1000.

## 0. Κοινοί κανόνες

- [ ] Commissioner 400–800 σε όλη τη ροή.
- [ ] Tokens ακριβώς: ink `#0B0B0B`, lime `#B0F90C`, bg `#F4F4F2`, border `#E6E6E2`, lime-soft `#F1FBD6` και τα καθορισμένα γκρι.
- [ ] Κάθε shadcn default override (radius, padding, shadow, focus ring, χρώμα).
- [ ] Δεν εμφανίζεται η demo μπάρα «Reference».
- [ ] Οι πραγματικές τιμές προέρχονται από υπάρχον backend/state· χωρίς νέα DB fields.
- [ ] Tap targets ≥44×44, aria-label στα icon buttons και 16px inputs στο iOS.

## 1. Overview ημέρας (`#overview`)

- [ ] Hero 290px με cover εικόνα ημέρας, opacity .75 και ακριβές gradient.
- [ ] Lime λοξή γραμμή 14px / `skewX(-16deg)` στη σωστή θέση.
- [ ] Άνω πλοήγηση «‹ Πρόγραμμα» και μενού 38px.
- [ ] Badge «ΗΜΕΡΑ Χ / Ν», badge εβδομάδας και τίτλος ημέρας με τις ακριβείς τιμές.
- [ ] Grid στατιστικών 3 στηλών: ασκήσεις, sets, διάρκεια.
- [ ] Προαιρετική σημείωση coach με avatar/αρχικά.
- [ ] Τίτλος «Ασκήσεις» και πραγματική τελευταία ημερομηνία.
- [ ] Κάρτα κάθε άσκησης: αριθμός, εικόνα 48px, δεδομένα, τελευταία κιλά και άνοιγμα Sheet.
- [ ] Σταθερό CTA 54px: «Ξεκίνα» ή «Συνέχισε προπόνηση».
- [ ] Το υπάρχον mobile bottom-nav μένει ορατό με ενεργό «Πρόγραμμα».
- [ ] Λογική επόμενης ημέρας Χ/Ν ακολουθεί τη σειρά του προγράμματος.

## 2. Προπόνηση σε εξέλιξη (`#live`)

### Header και στατιστικά

- [ ] Μαύρο header με ύψη, gaps και τρία 34px icon controls όπως στο reference.
- [ ] Κεντρικό «ΗΜΕΡΑ Χ / Ν» και «Προπόνηση».
- [ ] Διάρκεια 40px italic, όγκος και sets με σωστό υπολογισμό `kg × επαναλήψεις`.
- [ ] Progress με ένα segment ανά set, lime ολοκληρωμένα και `#333` υπόλοιπα.

### Accordion ασκήσεων

- [ ] Κλειστή ολοκληρωμένη άσκηση: opacity .7, lime video badge, best/πρόοδος Κ/Ν.
- [ ] Κλειστή μη ολοκληρωμένη άσκηση: σωστό υπότιτλο και Κ/Ν.
- [ ] Ανοιχτή άσκηση: border 1.5px ink, radius 18, ακριβή paddings.
- [ ] Άνοιγμα εικόνας/video οδηγεί στο Sheet άσκησης.
- [ ] Κουμπί «Έναρξη» διαλείμματος στο ακριβές pill styling.
- [ ] Header table grid `34px 1fr 64px 64px 36px`.
- [ ] Ολοκληρωμένο set: `#F1FBD6`, μαύρο 36px κουτί και lime check.
- [ ] Τρέχον set: white inputs 38px, ink 1.5px borders.
- [ ] Επόμενα sets: `#F6F6F3`, muted borders/κείμενο.
- [ ] Μενού τύπου set παραμένει λειτουργικό.
- [ ] Πάτημα «ΠΡΟΗΓ.» αντιγράφει προηγούμενο βάρος/επαναλήψεις.
- [ ] «+ Προσθήκη set» με ακριβές dashed styling και αντιγραφή τελευταίου set.

### Κάτω περιοχή

- [ ] Fixed fade προς `#F4F4F2`.
- [ ] Card διαλείμματος: μαύρη, radius 22, progress, −15/+15/Παράλειψη.
- [ ] Κουμπί ολοκλήρωσης 52px, badge Κ/Ν και διαφορετική κατάσταση όταν τρέχει διάλειμμα.

## 3. Sheet άσκησης (`#exercise`)

- [ ] Overlay `rgba(11,11,11,.55)` και bottom Sheet ~88%, radius 26.
- [ ] Handle 44×5, badge «Προπόνηση σε εξέλιξη · διάρκεια» όπου απαιτείται.
- [ ] Video 16:9 / 200px, poster, gradient, 64px lime play, progress/duration και `playsinline`.
- [ ] Τίτλος 22/800 και chips μυών/εξοπλισμού/επιπέδου.
- [ ] Βήματα εκτέλεσης με αριθμημένους κύκλους και σωστή τυπογραφία.
- [ ] Προαιρετική coach note και δύο κάρτες καλύτερο set/τελευταία φορά.
- [ ] Ιστορικό άσκησης μεταφέρεται στο Sheet.
- [ ] Close με Χ, overlay ή Esc χωρίς να σταματά η προπόνηση/χρονόμετρα.

## 4. Ρολόι στο παρασκήνιο (`#bg`)

- [ ] Header clock γίνεται lime 34px pill με χρόνο, glow και άνοιγμα Sheet.
- [ ] Όταν δεν τρέχει διάλειμμα δεν εμφανίζεται rest card και η ολοκλήρωση είναι μαύρη.

## 5. Ρολόι — Αντίστροφη (`#timer`)

- [ ] Black Sheet, overlay .55, handle, τίτλος και close control με ακριβείς διαστάσεις.
- [ ] Tabs «Αντίστροφη | Χρονόμετρο» με active lime κατάσταση.
- [ ] 210px conic countdown ring και 190px black εσωτερικό.
- [ ] Χρόνος 58px italic, −15/+15 κύκλοι 56px.
- [ ] Presets 30″, 60″, 90″, 2′, 3′, 5′.
- [ ] Ενέργειες Έναρξη / Παύση / Συνέχεια / Μηδενισμός με τις σωστές καταστάσεις.

## 6. Ρολόι — Χρονόμετρο (`#stopwatch`)

- [ ] Ring 60 ticks, 2×10px ανά 6° με lime progress.
- [ ] Χρόνος με εκατοστά, γύρος Ν και σωστή τυπογραφία.
- [ ] Λίστα γύρων νεότερος πρώτος και badge «ΤΑΧΥΤΕΡΟΣ».
- [ ] Ενέργειες Γύρος / Έναρξη-Παύση / Μηδενισμός.

## 7. Ρολόι σε άλλη σελίδα (`#elsewhere`)

- [ ] Global component στο client layout όταν τρέχει ρολόι και το Sheet είναι κλειστό.
- [ ] Θέση right 14px / bottom 92px, 56px black pill και 40px progress ring.
- [ ] Ετικέτα mode και lime italic χρόνος.
- [ ] Πάτημα ανοίγει ξανά το σωστό Sheet.

## 8. Συμπεριφορά και αντοχή σε αλλαγές κατάστασης

- [ ] Exit dialog: Αποθήκευση & έξοδος / Απόρριψη / Συνέχεια.
- [ ] Ρυθμίσεις: μονάδα, διάλειμμα, auto-rest, ήχος, wake lock, μία-μία/όλες.
- [ ] Μία-μία: τρέχουσα ανοικτή και αυτόματη μετάβαση στην επόμενη ημιτελή.
- [ ] Όλες ανοιχτές: όλες οι ασκήσεις ανοικτές από την αρχή.
- [ ] Toggle set: δόνηση όπου υποστηρίζεται και προαιρετικό auto-rest.
- [ ] Ένα ενεργό διάλειμμα τη φορά, νέο «Έναρξη» το αντικαθιστά.
- [ ] Τέλος διαλείμματος: ήχος, δόνηση, Notification API όπου επιτρέπεται, «Τέλος!» ~4s.
- [ ] Ολοκλήρωση με ανοιχτά sets ζητά επιβεβαίωση.
- [ ] Ολοκλήρωση/έξοδος σταματά clocks, κάνει release wake lock και διατηρεί την υπάρχουσα σύνοψη.
- [ ] Draft αποθηκεύεται σε κάθε αλλαγή και συνεχίζεται μετά από refresh.
- [ ] Clocks έχουν κοινό store, χρησιμοποιούν `Date.now()`, persist και επαναϋπολογισμό visibilitychange.
- [ ] Screen Wake Lock γίνεται request/restore/release μόνο όταν είναι ενεργό και υποστηρίζεται.

## 9. Έλεγχος πριν το κλείσιμο

- [ ] Dev-only fixture με reference data, όχι production data.
- [ ] Screenshots reference ↔ εφαρμογή στα 390×1000 για `#overview`.
- [ ] Screenshots reference ↔ εφαρμογή στα 390×1000 για `#live` και states sets/rest.
- [ ] Screenshots reference ↔ εφαρμογή στα 390×1000 για `#exercise`.
- [ ] Screenshots reference ↔ εφαρμογή στα 390×1000 για `#bg`, `#timer`, `#stopwatch`, `#elsewhere`.
- [ ] Functional tests: auto-rest on/off, δύο διαδοχικά rests, clock across page, refresh, background 2′, wake lock, δύο accordion modes.
- [ ] Type-check, production build και τελική αναφορά με τυχόν πραγματικές αποκλίσεις.

## Προγραμματισμένες αλλαγές (μετά από έγκριση)

1. `frontend/components/pages/client-program-page.tsx` — orchestration, overview, draft/exit/complete flow και πραγματικά δεδομένα.
2. `frontend/components/client/mobile-workout-flow.tsx` — αντικατάσταση της ενδιάμεσης live UI με το ακριβές `#live`.
3. `frontend/components/client/rest-timer.tsx` — πλήρες `#timer` / `#stopwatch`, persistence και notifications.
4. `frontend/components/client/set-row.tsx` — states set και αντιγραφή προηγούμενου.
5. `frontend/components/client/workout-summary.tsx` — μόνο προσαρμογή συμβατότητας αν απαιτηθεί από τη νέα completion flow.
6. `frontend/components/shell/client-shell.tsx` ή νέο shared client clock component — global `#elsewhere` pill.

Δεν προβλέπεται αλλαγή backend, database, routes ή προσθήκη βιβλιοθήκης.
