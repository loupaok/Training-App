"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PlanHeader, PlanHistory, SelectField, type PlanHistoryRow } from "@/components/shared/plan-editor-ui";

export interface FoodEntry {
  foodName: string;
  quantity: string | number;
  calories: string | number;
  proteinG: string | number;
  carbsG: string | number;
  fatG: string | number;
}

export interface MealEntry {
  mealType: string;
  title: string;
  notes: string;
  foods: FoodEntry[];
}

export interface NutritionPlanState {
  title: string;
  description: string;
  dailyCalories: string | number;
  proteinG: string | number;
  carbsG: string | number;
  fatG: string | number;
  notes: string;
  meals: MealEntry[];
  templateId?: number | string | null;
  templateTitle?: string | null;
}

export interface RawFood {
  food_name?: string;
  foodName?: string;
  quantity?: string | number;
  calories?: string | number;
  protein_g?: string | number;
  proteinG?: string | number;
  carbs_g?: string | number;
  carbsG?: string | number;
  fat_g?: string | number;
  fatG?: string | number;
}

export interface RawMeal {
  meal_type?: string;
  mealType?: string;
  title?: string;
  notes?: string;
  foods?: RawFood[];
}

export interface RawNutritionPlan {
  id?: number | string;
  meals?: RawMeal[];
  title?: string;
  description?: string;
  daily_calories?: string | number;
  protein_g?: string | number;
  carbs_g?: string | number;
  fat_g?: string | number;
  notes?: string;
  goal?: string;
  template_id?: number | string | null;
  template_title?: string | null;
}

export function defaultNutritionPlan(): NutritionPlanState {
  return {
    title: "Πρόγραμμα Διατροφής",
    description: "",
    dailyCalories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    notes: "",
    meals: [
      { mealType: "breakfast", title: "Πρωινό", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
      { mealType: "lunch", title: "Μεσημεριανό", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
      { mealType: "snack", title: "Σνακ", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
      { mealType: "dinner", title: "Βραδινό", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
    ],
  };
}

export function normalizeNutritionPlan(plan?: RawNutritionPlan | null): NutritionPlanState {
  const base = defaultNutritionPlan();
  if (!plan?.id && !plan?.meals?.length) return base;

  return {
    title: plan.title || base.title,
    description: plan.description || "",
    dailyCalories: plan.daily_calories || "",
    proteinG: plan.protein_g || "",
    carbsG: plan.carbs_g || "",
    fatG: plan.fat_g || "",
    notes: plan.notes || "",
    templateId: plan.template_id ?? null,
    templateTitle: plan.template_title ?? null,
    meals: (plan.meals?.length ? (plan.meals as RawMeal[]) : (base.meals as RawMeal[])).map((meal) => ({
      mealType: meal.meal_type || meal.mealType || "other",
      title: meal.title || "",
      notes: meal.notes || "",
      foods: (
        meal.foods?.length
          ? (meal.foods as RawFood[])
          : ([{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] as RawFood[])
      ).map((food) => ({
        foodName: food.food_name || food.foodName || "",
        quantity: food.quantity || "",
        calories: food.calories || "",
        proteinG: food.protein_g || food.proteinG || "",
        carbsG: food.carbs_g || food.carbsG || "",
        fatG: food.fat_g || food.fatG || "",
      })),
    })),
  };
}

export function NutritionPlanEditor({
  plan,
  setPlan,
  onSave,
  onCreateNew,
  saving,
  history = [],
  title = "Πρόγραμμα Διατροφής",
  subtitle = "Ένα ενεργό πρόγραμμα διατροφής για τον πελάτη. Το ανανεώνει μόνο ο admin όταν χρειαστεί.",
}: {
  plan: NutritionPlanState;
  setPlan: Dispatch<SetStateAction<NutritionPlanState>>;
  onSave: () => void;
  onCreateNew?: () => void;
  saving: boolean;
  history?: PlanHistoryRow[];
  title?: string;
  subtitle?: string;
}) {
  const updateMeal = (mealIndex: number, patch: Partial<MealEntry>) => {
    setPlan((current) => ({
      ...current,
      meals: current.meals.map((meal, index) => (index === mealIndex ? { ...meal, ...patch } : meal)),
    }));
  };

  const updateFood = (mealIndex: number, foodIndex: number, patch: Partial<FoodEntry>) => {
    const meal = plan.meals[mealIndex];
    updateMeal(mealIndex, {
      foods: meal.foods.map((food, index) => (index === foodIndex ? { ...food, ...patch } : food)),
    });
  };

  const addMeal = () => {
    setPlan((current) => ({
      ...current,
      meals: [...current.meals, { mealType: "other", title: "Γεύμα", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] }],
    }));
  };

  const addFood = (mealIndex: number) => {
    updateMeal(mealIndex, {
      foods: [...plan.meals[mealIndex].foods, { foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }],
    });
  };

  const removeMeal = (mealIndex: number) => {
    setPlan((current) => ({ ...current, meals: current.meals.filter((_, index) => index !== mealIndex) }));
  };

  const removeFood = (mealIndex: number, foodIndex: number) => {
    updateMeal(mealIndex, { foods: plan.meals[mealIndex].foods.filter((_, index) => index !== foodIndex) });
  };

  return (
    <Card className="p-0">
      <PlanHeader title={title} subtitle={subtitle} onSave={onSave} onCreateNew={onCreateNew} saving={saving} />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <Field label="Τίτλος" value={plan.title} onChange={(value) => setPlan({ ...plan, title: value })} />
          <Field label="Θερμίδες" type="number" value={plan.dailyCalories} onChange={(value) => setPlan({ ...plan, dailyCalories: value })} />
          <Field label="Πρωτεΐνη g" type="number" value={plan.proteinG} onChange={(value) => setPlan({ ...plan, proteinG: value })} />
          <Field label="Υδατάνθρακες g" type="number" value={plan.carbsG} onChange={(value) => setPlan({ ...plan, carbsG: value })} />
          <Field label="Λίπη g" type="number" value={plan.fatG} onChange={(value) => setPlan({ ...plan, fatG: value })} />
        </div>
        <Field label="Γενικές οδηγίες διατροφής" value={plan.notes} onChange={(value) => setPlan({ ...plan, notes: value })} />

        {plan.meals.map((meal, mealIndex) => (
          <div key={mealIndex} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Γεύμα" value={meal.title} onChange={(value) => updateMeal(mealIndex, { title: value })} />
              <SelectField
                label="Τύπος"
                value={meal.mealType}
                onChange={(value) => updateMeal(mealIndex, { mealType: value })}
                options={[
                  ["breakfast", "Πρωινό"],
                  ["lunch", "Μεσημεριανό"],
                  ["snack", "Σνακ"],
                  ["dinner", "Βραδινό"],
                  ["pre_workout", "Πριν την προπόνηση"],
                  ["post_workout", "Μετά την προπόνηση"],
                  ["other", "Άλλο"],
                ]}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => removeMeal(mealIndex)}
                className="h-auto self-end gap-2 border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Διαγραφή γεύματος
              </Button>
            </div>
            <Field label="Οδηγίες γεύματος" value={meal.notes} onChange={(value) => updateMeal(mealIndex, { notes: value })} className="mt-4" />

            <div className="mt-4 space-y-3">
              {meal.foods.map((food, foodIndex) => (
                <div key={foodIndex} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] dark:border-slate-800 dark:bg-slate-900">
                  <Field compact label="Τρόφιμο" value={food.foodName} onChange={(value) => updateFood(mealIndex, foodIndex, { foodName: value })} />
                  <Field compact label="Ποσότητα" value={food.quantity} onChange={(value) => updateFood(mealIndex, foodIndex, { quantity: value })} />
                  <Field compact label="Kcal" type="number" value={food.calories} onChange={(value) => updateFood(mealIndex, foodIndex, { calories: value })} />
                  <Field compact label="Πρωτ." type="number" value={food.proteinG} onChange={(value) => updateFood(mealIndex, foodIndex, { proteinG: value })} />
                  <Field compact label="Υδ/κες" type="number" value={food.carbsG} onChange={(value) => updateFood(mealIndex, foodIndex, { carbsG: value })} />
                  <Field compact label="Λίπη" type="number" value={food.fatG} onChange={(value) => updateFood(mealIndex, foodIndex, { fatG: value })} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeFood(mealIndex, foodIndex)}
                    className="h-auto self-end border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Διαγραφή
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addFood(mealIndex)}
                className="h-10 w-full gap-2 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 sm:w-auto dark:text-slate-200 dark:hover:border-red-500/30 dark:hover:text-red-400"
              >
                <Plus className="h-4 w-4" />
                Προσθήκη τροφίμου
              </Button>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addMeal} className="h-11 gap-2 px-5 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 dark:text-slate-200 dark:hover:border-red-500/30 dark:hover:text-red-400">
          <Plus className="h-4 w-4" />
          Προσθήκη γεύματος
        </Button>

        <PlanHistory rows={history} countLabel={(row) => (row.daily_calories ? `${row.daily_calories} kcal` : "-")} />
      </div>
    </Card>
  );
}
