"use client";

import type { RawTrainingDay } from "@/components/shared/training-plan-editor";
import type { RawMeal } from "@/components/shared/nutrition-plan-editor";

const dayLabels = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

export interface TrainingTemplateDetail {
  id: number | string;
  title: string;
  description?: string;
  goal?: string;
  level?: string;
  days_per_week?: number;
  days?: RawTrainingDay[];
}

export interface NutritionTemplateDetail {
  id: number | string;
  title: string;
  description?: string;
  goal?: string;
  daily_calories?: number;
  protein_g?: number | string;
  carbs_g?: number | string;
  fat_g?: number | string;
  meals?: RawMeal[];
}

const mealTypeLabels: Record<string, string> = {
  breakfast: "Πρωινό",
  lunch: "Μεσημεριανό",
  snack: "Σνακ",
  dinner: "Βραδινό",
  pre_workout: "Πριν την προπόνηση",
  post_workout: "Μετά την προπόνηση",
  other: "Άλλο",
};

export function TrainingTemplatePreview({ template }: { template: TrainingTemplateDetail }) {
  const days = template.days || [];
  return (
    <div className="space-y-4">
      {template.description && <p className="text-sm text-slate-600 dark:text-slate-400">{template.description}</p>}
      {!days.length && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν έχουν προστεθεί ημέρες ακόμα.</p>}
      {days.map((day, dayIndex) => (
        <div key={dayIndex} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
            {day.title || dayLabels[Number(day.day_of_week ?? 0)]}
          </div>
          <ul className="mt-2 space-y-1">
            {(day.exercises || []).map((exercise, index) => (
              <li key={index} className="text-sm text-slate-600 dark:text-slate-400">
                {exercise.exercise_name || exercise.exerciseName}
                {exercise.sets || exercise.reps ? ` — ${exercise.sets || "-"} x ${exercise.reps || "-"}` : ""}
              </li>
            ))}
            {!day.exercises?.length && <li className="text-sm text-slate-400 dark:text-slate-500">Χωρίς ασκήσεις.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function NutritionTemplatePreview({ template }: { template: NutritionTemplateDetail }) {
  const meals = template.meals || [];
  return (
    <div className="space-y-4">
      {template.description && <p className="text-sm text-slate-600 dark:text-slate-400">{template.description}</p>}
      <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
        {template.daily_calories && <span>{template.daily_calories} kcal</span>}
        {template.protein_g && <span>P: {template.protein_g}g</span>}
        {template.carbs_g && <span>C: {template.carbs_g}g</span>}
        {template.fat_g && <span>F: {template.fat_g}g</span>}
      </div>
      {!meals.length && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν έχουν προστεθεί γεύματα ακόμα.</p>}
      {meals.map((meal, mealIndex) => (
        <div key={mealIndex} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
            {meal.title || mealTypeLabels[meal.meal_type || meal.mealType || "other"]}
          </div>
          <ul className="mt-2 space-y-1">
            {(meal.foods || []).map((food, index) => (
              <li key={index} className="text-sm text-slate-600 dark:text-slate-400">
                {food.food_name || food.foodName}
                {food.quantity ? ` (${food.quantity})` : ""}
                {food.calories ? ` — ${food.calories} kcal` : ""}
              </li>
            ))}
            {!meal.foods?.length && <li className="text-sm text-slate-400 dark:text-slate-500">Χωρίς τρόφιμα.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
