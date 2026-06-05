import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const fallbackExercises = [
  ['Bench Press', 'Στήθος', 'Τρικέφαλοι, Ώμοι', 'Μπάρα, Πάγκος', 'Μεσαίο', 'Δύναμη', 'Πίεσε τη μπάρα από το στήθος προς τα πάνω κρατώντας ωμοπλάτες σταθερές και πόδια πατημένα.', 24],
  ['Incline Dumbbell Press', 'Στήθος (Άνω)', 'Ώμοι, Τρικέφαλοι', 'Αλτήρες, Πάγκος με Κλίση', 'Μεσαίο', 'Υπερτροφία', 'Σε επικλινή πάγκο πίεσε τους αλτήρες προς τα πάνω, χωρίς να χάνεις τον έλεγχο στην κάθοδο.', 18],
  ['Cable Fly', 'Στήθος', 'Ώμοι', 'Τροχαλία', 'Αρχάριο', 'Υπερτροφία', 'Φέρε τις λαβές μπροστά από το στήθος με ελαφρά λυγισμένους αγκώνες και αργή επιστροφή.', 9],
  ['Back Squat', 'Τετρακέφαλοι', 'Γλουτοί, Οπίσθιοι Μηριαίοι', 'Μπάρα', 'Δύσκολο', 'Δύναμη', 'Κράτα κορμό σταθερό, λύγισε γόνατα και ισχία, και ανέβα πιέζοντας όλο το πέλμα στο έδαφος.', 31],
  ['Bulgarian Split Squat', 'Τετρακέφαλοι, Γλουτοί', 'Προσαγωγοί', 'Αλτήρες, Πάγκος', 'Μεσαίο', 'Υπερτροφία', 'Το πίσω πόδι στηρίζεται σε πάγκο και κατεβαίνεις κάθετα κρατώντας το μπροστινό γόνατο ελεγχόμενο.', 12],
  ['Leg Press', 'Τετρακέφαλοι', 'Γλουτοί', 'Μηχάνημα', 'Αρχάριο', 'Υπερτροφία', 'Κατέβασε την πλατφόρμα ελεγχόμενα και πίεσε χωρίς να κλειδώνεις απότομα τα γόνατα.', 22],
  ['Deadlift', 'Οπίσθιοι Μηριαίοι, Γλουτοί', 'Πλάτη, Κορμός', 'Μπάρα', 'Δύσκολο', 'Δύναμη', 'Κράτα ουδέτερη σπονδυλική στήλη, τη μπάρα κοντά στο σώμα και σήκω με ισχία και πόδια.', 27],
  ['Romanian Deadlift', 'Οπίσθιοι Μηριαίοι', 'Γλουτοί, Ράχη', 'Μπάρα', 'Μεσαίο', 'Υπερτροφία', 'Κάνε hip hinge με ελαφρά λυγισμένα γόνατα, νιώθοντας διάταση στους οπίσθιους μηριαίους.', 20],
  ['Hip Thrust', 'Γλουτοί', 'Οπίσθιοι Μηριαίοι', 'Μπάρα, Πάγκος', 'Μεσαίο', 'Υπερτροφία', 'Στήριξε την πλάτη στον πάγκο και ανέβασε τη λεκάνη μέχρι πλήρη σύσπαση γλουτών.', 19],
  ['Pull Up', 'Πλάτη (Ευρείς)', 'Δικέφαλοι', 'Σωματικό Βάρος, Μονόζυγο', 'Μεσαίο', 'Δύναμη', 'Τράβα το σώμα προς το μονόζυγο με στήθος ψηλά και ελεγχόμενη κάθοδο.', 20],
  ['Lat Pulldown', 'Πλάτη (Ευρείς)', 'Δικέφαλοι', 'Μηχάνημα, Τροχαλία', 'Μεσαίο', 'Υπερτροφία', 'Τράβα τη μπάρα προς το πάνω στήθος κρατώντας τους αγκώνες προς τα κάτω.', 15],
  ['Seated Cable Row', 'Πλάτη', 'Δικέφαλοι, Ρομβοειδείς', 'Τροχαλία', 'Αρχάριο', 'Υπερτροφία', 'Τράβα τη λαβή προς την κοιλιά, ενώνοντας τις ωμοπλάτες χωρίς υπερέκταση μέσης.', 17],
  ['Overhead Press', 'Ώμοι', 'Τρικέφαλοι', 'Μπάρα', 'Μεσαίο', 'Δύναμη', 'Πίεσε τη μπάρα πάνω από το κεφάλι με σφιχτό κορμό και ελεγχόμενη πορεία.', 17],
  ['Lateral Raise', 'Ώμοι', 'Τραπεζοειδείς', 'Αλτήρες', 'Αρχάριο', 'Υπερτροφία', 'Σήκωσε τους αλτήρες πλάγια μέχρι το ύψος των ώμων χωρίς ορμή.', 26],
  ['Face Pull', 'Πίσω Ώμοι', 'Τραπεζοειδείς', 'Τροχαλία', 'Αρχάριο', 'Υγεία Ώμων', 'Τράβα το σχοινί προς το πρόσωπο με αγκώνες ψηλά και έλεγχο στην επιστροφή.', 11],
  ['Barbell Curl', 'Δικέφαλοι', 'Πήχεις', 'Μπάρα', 'Αρχάριο', 'Υπερτροφία', 'Κράτα αγκώνες σταθερούς και λύγισε τους αγκώνες χωρίς να κουνάς τον κορμό.', 16],
  ['Hammer Curl', 'Δικέφαλοι', 'Πήχεις', 'Αλτήρες', 'Αρχάριο', 'Υπερτροφία', 'Κράτα ουδέτερη λαβή και ανέβασε τους αλτήρες ελεγχόμενα.', 14],
  ['Triceps Pushdown', 'Τρικέφαλοι', 'Ώμοι', 'Τροχαλία', 'Αρχάριο', 'Υπερτροφία', 'Πίεσε τη λαβή προς τα κάτω κρατώντας τους αγκώνες κοντά στο σώμα.', 18],
  ['Skull Crusher', 'Τρικέφαλοι', 'Ώμοι', 'Μπάρα EZ, Πάγκος', 'Μεσαίο', 'Υπερτροφία', 'Κατέβασε τη μπάρα προς το μέτωπο με σταθερούς βραχίονες και έκτεινε τους αγκώνες.', 10],
  ['Plank', 'Κορμός', 'Ώμοι, Γλουτοί', 'Σωματικό Βάρος', 'Αρχάριο', 'Σταθεροποίηση', 'Κράτα ευθεία γραμμή από κεφάλι μέχρι φτέρνες με σφιχτή κοιλιά.', 25],
  ['Hanging Leg Raise', 'Κοιλιακοί', 'Καμπτήρες Ισχίου', 'Μονόζυγο', 'Δύσκολο', 'Κορμός', 'Σήκωσε τα πόδια ελεγχόμενα χωρίς ταλάντωση και κατέβα αργά.', 13],
  ['Calf Raise', 'Γάμπες', 'Πέλματα', 'Μηχάνημα ή Αλτήρες', 'Αρχάριο', 'Υπερτροφία', 'Ανέβα στις μύτες πλήρως και κατέβα μέχρι διάταση στη γάμπα.', 21],
  ['Lunge', 'Τετρακέφαλοι, Γλουτοί', 'Οπίσθιοι Μηριαίοι', 'Αλτήρες ή Σωματικό Βάρος', 'Αρχάριο', 'Λειτουργική', 'Κάνε βήμα μπροστά και κατέβα μέχρι το πίσω γόνατο να πλησιάσει το έδαφος.', 19],
  ['Chest Supported Row', 'Πλάτη', 'Πίσω Ώμοι', 'Αλτήρες, Πάγκος', 'Μεσαίο', 'Υπερτροφία', 'Στήριξε το στήθος στον πάγκο και τράβα τους αλτήρες προς τα πλευρά.', 8],
];

const DATASET_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

const muscleMap = {
  abdominals: 'Κοιλιακοί',
  abductors: 'Απαγωγοί',
  adductors: 'Προσαγωγοί',
  biceps: 'Δικέφαλοι',
  calves: 'Γάμπες',
  chest: 'Στήθος',
  forearms: 'Πήχεις',
  glutes: 'Γλουτοί',
  hamstrings: 'Οπίσθιοι Μηριαίοι',
  lats: 'Πλάτη (Ευρείς)',
  'lower back': 'Κάτω Πλάτη',
  'middle back': 'Πλάτη',
  neck: 'Αυχένας',
  quadriceps: 'Τετρακέφαλοι',
  shoulders: 'Ώμοι',
  traps: 'Τραπεζοειδείς',
  triceps: 'Τρικέφαλοι',
};

const equipmentMap = {
  'body only': 'Σωματικό Βάρος',
  barbell: 'Μπάρα',
  dumbbell: 'Αλτήρες',
  cable: 'Τροχαλία',
  machine: 'Μηχάνημα',
  kettlebells: 'Kettlebells',
  bands: 'Λάστιχα',
  'medicine ball': 'Medicine Ball',
  'exercise ball': 'Exercise Ball',
  'foam roll': 'Foam Roller',
  other: 'Άλλο',
  null: 'Χωρίς Εξοπλισμό',
};

const levelMap = {
  beginner: 'Αρχάριο',
  intermediate: 'Μεσαίο',
  expert: 'Δύσκολο',
};

function translateMuscle(value) {
  return muscleMap[value] || value || 'Άλλο';
}

function translateEquipment(value) {
  return equipmentMap[value ?? 'null'] || value || 'Χωρίς Εξοπλισμό';
}

function fallbackImageUrl(name) {
  return null;
}

async function loadExercises() {
  try {
    const response = await fetch(DATASET_URL);
    if (!response.ok) throw new Error(`Dataset request failed: ${response.status}`);
    const dataset = await response.json();

    return dataset.map((item) => {
      const primaryMuscles = item.primaryMuscles || [];
      const secondaryMuscles = item.secondaryMuscles || [];
      const imagePath = item.images?.[0];

      return [
        item.name,
        primaryMuscles.map(translateMuscle).join(', ') || 'Άλλο',
        secondaryMuscles.map(translateMuscle).join(', ') || null,
        translateEquipment(item.equipment),
        levelMap[item.level] || 'Μεσαίο',
        item.category || 'strength',
        Array.isArray(item.instructions) ? item.instructions.join('\n') : item.instructions,
        0,
        imagePath ? `${IMAGE_BASE_URL}${imagePath}` : fallbackImageUrl(item.name),
      ];
    });
  } catch (error) {
    console.warn(`Could not download public exercise dataset. Using fallback seed. Reason: ${error.message}`);
    return fallbackExercises.map((exercise) => [...exercise, fallbackImageUrl(exercise[0])]);
  }
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

await connection.query(`
  CREATE TABLE IF NOT EXISTS exercises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    muscle_group VARCHAR(120) NOT NULL,
    secondary_muscles VARCHAR(255),
    equipment VARCHAR(255) NOT NULL,
    level ENUM('Αρχάριο', 'Μεσαίο', 'Δύσκολο') DEFAULT 'Αρχάριο',
    type VARCHAR(120) NOT NULL,
    image_url VARCHAR(600),
    video_url VARCHAR(600),
    instructions TEXT,
    programs_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_muscle_group (muscle_group),
    INDEX idx_equipment (equipment),
    INDEX idx_level (level),
    INDEX idx_type (type)
  )
`);

await connection.query(
  "UPDATE exercises SET image_url = NULL WHERE image_url LIKE 'https://source.unsplash.com/%'"
);

const exercises = await loadExercises();

for (const exercise of exercises) {
  const [name, muscleGroup, secondaryMuscles, equipment, level, type, instructions, programsCount, imageUrl] = exercise;
  await connection.query(
    `INSERT INTO exercises
      (name, muscle_group, secondary_muscles, equipment, level, type, image_url, instructions, programs_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       muscle_group = VALUES(muscle_group),
       secondary_muscles = VALUES(secondary_muscles),
       equipment = VALUES(equipment),
       level = VALUES(level),
       type = VALUES(type),
       image_url = VALUES(image_url),
       instructions = VALUES(instructions),
       programs_count = VALUES(programs_count)`,
    [name, muscleGroup, secondaryMuscles, equipment, level, type, imageUrl, instructions, programsCount]
  );
}

const [[{ total }]] = await connection.query('SELECT COUNT(*) AS total FROM exercises');
await connection.end();

console.log(`Exercises table ready. Total exercises: ${total}`);
