import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

function greekInstructions(exercise) {
  const name = exercise.name;
  const muscleGroup = exercise.muscle_group || 'τη βασική μυϊκή ομάδα';
  const secondary = exercise.secondary_muscles || 'τους σταθεροποιητές μύες';
  const equipment = exercise.equipment || 'τον διαθέσιμο εξοπλισμό';
  const level = exercise.level || 'Μεσαίο';
  const type = exercise.type || 'προπόνηση δύναμης';

  return [
    `Η άσκηση ${name} στοχεύει κυρίως σε ${muscleGroup} και βοηθητικά σε ${secondary}.`,
    `Ρύθμισε σωστά τον εξοπλισμό (${equipment}) και κράτησε σταθερή θέση σώματος πριν ξεκινήσεις.`,
    'Εκτέλεσε την κίνηση αργά και ελεγχόμενα, χωρίς απότομες κινήσεις ή υπερβολική φόρα.',
    'Κράτησε ουδέτερη στάση στον κορμό, σταθερή αναπνοή και πλήρη έλεγχο στην επιστροφή.',
    `Για επίπεδο ${level}, επίλεξε βάρος που επιτρέπει σωστή τεχνική σε όλο το σετ.`,
    `Χρησιμοποίησέ την ως άσκηση τύπου ${type}, δίνοντας προτεραιότητα στην τεχνική πριν την αύξηση φορτίου.`,
  ].join('\n');
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await connection.query(
  'SELECT id, name, muscle_group, secondary_muscles, equipment, level, type FROM exercises'
);

for (const exercise of rows) {
  await connection.query(
    'UPDATE exercises SET instructions = ? WHERE id = ?',
    [greekInstructions(exercise), exercise.id]
  );
}

await connection.end();

console.log(`Updated Greek descriptions for ${rows.length} exercises.`);
