function count(items) {
  return Array.isArray(items) ? items.length : 0;
}

function value(item, ...keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) return item[key];
  }
  return null;
}

function changed(before, after) {
  return String(before ?? '') !== String(after ?? '');
}

export function summarizeNutritionChanges(previous, next = {}) {
  if (!previous) return { title: 'Δημιουργήθηκε νέο πλάνο διατροφής', detail: next.title ? `Πλάνο: ${next.title}` : null };

  const changes = [];
  const macroLabels = [
    ['daily_calories', 'dailyCalories', 'θερμίδες'],
    ['protein_g', 'proteinG', 'πρωτεΐνη'],
    ['carbs_g', 'carbsG', 'υδατάνθρακες'],
    ['fat_g', 'fatG', 'λίπος'],
  ];
  const macroChanges = macroLabels
    .filter(([oldKey, newKey]) => changed(previous[oldKey], next[newKey]))
    .map(([, , label]) => label);
  if (macroChanges.length) changes.push(`άλλαξαν ${macroChanges.join(', ')}`);
  if (changed(previous.notes, next.notes)) changes.push('ενημερώθηκαν οι σημειώσεις');

  const oldMeals = previous.meals || [];
  const newMeals = next.meals || [];
  if (oldMeals.length !== newMeals.length) {
    changes.push(newMeals.length > oldMeals.length ? `προστέθηκαν ${newMeals.length - oldMeals.length} γεύματα` : `αφαιρέθηκαν ${oldMeals.length - newMeals.length} γεύματα`);
  }
  newMeals.forEach((meal, index) => {
    const oldMeal = oldMeals[index];
    if (!oldMeal) return;
    const delta = count(meal.foods) - count(oldMeal.foods);
    const mealName = value(meal, 'title', 'name') || value(oldMeal, 'title', 'name') || `Γεύμα ${index + 1}`;
    if (delta > 0) changes.push(`${mealName}: +${delta} τρόφιμ${delta === 1 ? 'ο' : 'α'}`);
    if (delta < 0) changes.push(`${mealName}: ${delta} τρόφιμ${delta === -1 ? 'ο' : 'α'}`);
    if (changed(value(oldMeal, 'notes'), value(meal, 'notes'))) changes.push(`${mealName}: οδηγίες γεύματος`);
  });

  return {
    title: 'Ενημερώθηκε το πλάνο διατροφής',
    detail: changes.length ? changes.slice(0, 3).join(' · ') : 'Έγινε μικρή αλλαγή στο πλάνο',
  };
}

export function summarizeTrainingChanges(previous, next = {}) {
  if (!previous) return { title: 'Δημιουργήθηκε νέο πρόγραμμα προπόνησης', detail: next.title ? `Πρόγραμμα: ${next.title}` : null };

  const changes = [];
  if (changed(previous.duration_weeks, next.durationWeeks)) changes.push('άλλαξε η διάρκεια');
  if (changed(previous.difficulty, next.difficulty)) changes.push('άλλαξε η δυσκολία');
  const oldDays = previous.days || [];
  const newDays = next.days || [];
  if (oldDays.length !== newDays.length) changes.push(newDays.length > oldDays.length ? `προστέθηκαν ${newDays.length - oldDays.length} ημέρες` : `αφαιρέθηκαν ${oldDays.length - newDays.length} ημέρες`);
  newDays.forEach((day, index) => {
    const oldDay = oldDays[index];
    if (!oldDay) return;
    const delta = count(day.exercises) - count(oldDay.exercises);
    const dayName = value(day, 'title', 'name') || value(oldDay, 'title', 'name') || `Ημέρα ${index + 1}`;
    if (delta > 0) changes.push(`${dayName}: +${delta} ασκήσ${delta === 1 ? 'η' : 'εις'}`);
    if (delta < 0) changes.push(`${dayName}: ${delta} ασκήσ${delta === -1 ? 'η' : 'εις'}`);
    if (changed(value(oldDay, 'notes'), value(day, 'notes'))) changes.push(`${dayName}: ενημερώθηκαν οδηγίες`);
  });
  return {
    title: 'Ενημερώθηκε το πρόγραμμα προπόνησης',
    detail: changes.length ? changes.slice(0, 3).join(' · ') : 'Έγινε μικρή αλλαγή στο πρόγραμμα',
  };
}

export function supplementDetail(change, name, previous, next) {
  if (change === 'added') return `Προστέθηκε το «${name}»`;
  if (change === 'removed') return `Αφαιρέθηκε το «${name}»`;
  const changes = [];
  if (changed(previous?.dose_amount, next?.doseAmount) || changed(previous?.dose_unit, next?.doseUnit)) changes.push('δόση');
  if (changed(previous?.times_per_day, next?.timesPerDay)) changes.push('συχνότητα');
  if (changed(previous?.link, next?.link)) changes.push('σύνδεσμος');
  if (changed(previous?.name, next?.name)) changes.push('όνομα');
  return changes.length ? `«${name}»: άλλαξαν ${changes.join(', ')}` : `Ενημερώθηκε το «${name}»`;
}
