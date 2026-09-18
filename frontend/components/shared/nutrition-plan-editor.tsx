"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  Search,
  AlertTriangle,
  Coffee,
  UtensilsCrossed,
  Cookie,
  Moon,
  Zap,
  Dumbbell,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Field, PlanHeader, PlanHistory, SelectField, type PlanHistoryRow } from "@/components/shared/plan-editor-ui";

// ---------------------------------------------------------------------------
// Types, defaults, normalize — UNCHANGED from the current file, except:
//   - FoodEntry gains an optional `foodId` (new field, defaults undefined)
//   - RawFood/normalize read it back defensively for forward-compat, even
//     though the backend doesn't persist it yet.
// ---------------------------------------------------------------------------

export interface FoodEntry {
  foodId?: string | number;
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
  food_id?: string | number;
  foodId?: string | number;
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

// New — the shape /api/foods returns. Self-contained here, same pattern as
// LibraryExercise in training-plan-editor.tsx.
export interface LibraryFood {
  id: number | string;
  nameGr: string;
  nameEn?: string;
  category?: string;
  caloriesPer100g?: number | string | null;
  proteinPer100g?: number | string | null;
  carbsPer100g?: number | string | null;
  fatsPer100g?: number | string | null;
  fiberPer100g?: number | string | null;
  servingSize?: number | string | null;
  servingUnit?: string;
  imageUrl?: string;
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
        foodId: food.food_id ?? food.foodId ?? undefined,
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

const MEAL_TYPE_OPTIONS: [string, string][] = [
  ["breakfast", "Πρωινό"],
  ["lunch", "Μεσημεριανό"],
  ["snack", "Σνακ"],
  ["dinner", "Βραδινό"],
  ["pre_workout", "Πριν την προπόνηση"],
  ["post_workout", "Μετά την προπόνηση"],
  ["other", "Άλλο"],
];

const MEAL_ICONS: Record<string, LucideIcon> = {
  breakfast: Coffee,
  lunch: UtensilsCrossed,
  snack: Cookie,
  dinner: Moon,
  pre_workout: Zap,
  post_workout: Dumbbell,
  other: Utensils,
};

const FOOD_LIBRARY_CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "Όλα" },
  { key: "meat", label: "Κρέατα" },
  { key: "fish", label: "Ψάρια" },
  { key: "eggs", label: "Αυγά" },
  { key: "dairy", label: "Γαλακτοκομικά" },
  { key: "grains", label: "Δημητριακά" },
  { key: "vegetables", label: "Λαχανικά" },
  { key: "fruits", label: "Φρούτα" },
  { key: "legumes", label: "Όσπρια" },
  { key: "nuts", label: "Ξηροί Καρποί" },
  { key: "oils", label: "Έλαια" },
];

const FOOD_LIBRARY_PAGE_SIZE = 20;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function scaleFoodMacros(food: LibraryFood, grams: number) {
  const factor = grams / 100;
  return {
    calories: round1(Number(food.caloriesPer100g || 0) * factor),
    proteinG: round1(Number(food.proteinPer100g || 0) * factor),
    carbsG: round1(Number(food.carbsPer100g || 0) * factor),
    fatG: round1(Number(food.fatsPer100g || 0) * factor),
  };
}

// ---------------------------------------------------------------------------
// NutritionPlanEditor — same exported prop signature plus one new, optional
// `foods` prop (defaults to [] so existing call sites keep compiling).
// ---------------------------------------------------------------------------

export function NutritionPlanEditor({
  plan,
  setPlan,
  foods = [],
  onSave,
  onCreateNew,
  saving,
  history = [],
  title = "Πρόγραμμα Διατροφής",
  subtitle = "Ένα ενεργό πρόγραμμα διατροφής για τον πελάτη. Το ανανεώνει μόνο ο admin όταν χρειαστεί.",
}: {
  plan: NutritionPlanState;
  setPlan: Dispatch<SetStateAction<NutritionPlanState>>;
  foods?: LibraryFood[];
  onSave: () => void;
  onCreateNew?: () => void;
  saving: boolean;
  history?: PlanHistoryRow[];
  title?: string;
  subtitle?: string;
}) {
  // ---- existing functions, UNCHANGED ----
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

  // ---- NEW (approved): library pick = addFood + updateFood combined, at the food's default serving ----
  const addFoodFromLibrary = (mealIndex: number, food: LibraryFood) => {
    const grams = Number(food.servingSize) || 100;
    updateMeal(mealIndex, {
      foods: [
        ...(plan.meals[mealIndex]?.foods || []),
        { foodId: food.id, foodName: food.nameGr, quantity: String(grams), ...scaleFoodMacros(food, grams) },
      ],
    });
  };

  // ---- NEW (approved): quantity edits on a library-linked row rescale macros from per-100g values ----
  const updateFoodQuantity = (mealIndex: number, foodIndex: number, value: string) => {
    const food = plan.meals[mealIndex]?.foods[foodIndex];
    const libraryFood = food?.foodId != null ? foods.find((item) => String(item.id) === String(food.foodId)) : null;

    if (libraryFood) {
      updateFood(mealIndex, foodIndex, { quantity: value, ...scaleFoodMacros(libraryFood, Number(value) || 0) });
      return;
    }
    updateFood(mealIndex, foodIndex, { quantity: value });
  };

  // Manually editing the name text moves a row back to freeform (no longer tied to a library entry).
  const updateFoodName = (mealIndex: number, foodIndex: number, value: string) => {
    updateFood(mealIndex, foodIndex, { foodName: value, foodId: undefined });
  };

  const selectFoodFromLibrary = (mealIndex: number, foodIndex: number, food: LibraryFood) => {
    const currentQuantity = Number(plan.meals[mealIndex]?.foods[foodIndex]?.quantity);
    const grams = currentQuantity > 0 ? currentQuantity : Number(food.servingSize) || 100;
    updateFood(mealIndex, foodIndex, {
      foodId: food.id,
      foodName: food.nameGr,
      quantity: String(grams),
      ...scaleFoodMacros(food, grams),
    });
  };

  // ---- NEW (approved): right-panel food library — search/filter/paginate over the existing `foods` prop ----
  const [libraryQuery, setLibraryQuery] = useState("");
  const [debouncedLibraryQuery, setDebouncedLibraryQuery] = useState("");
  const [libraryCategory, setLibraryCategory] = useState("all");
  const [libraryVisibleCount, setLibraryVisibleCount] = useState(FOOD_LIBRARY_PAGE_SIZE);
  const libraryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedLibraryQuery(libraryQuery), 300);
    return () => window.clearTimeout(timeoutId);
  }, [libraryQuery]);

  useEffect(() => {
    setLibraryVisibleCount(FOOD_LIBRARY_PAGE_SIZE);
    if (libraryScrollRef.current) libraryScrollRef.current.scrollTop = 0;
  }, [debouncedLibraryQuery, libraryCategory]);

  const filteredLibraryFoods = foods.filter((item) => {
    if (libraryCategory !== "all" && item.category !== libraryCategory) return false;
    const q = debouncedLibraryQuery.trim().toLowerCase();
    if (!q) return true;
    return [item.nameGr, item.nameEn, item.category].join(" ").toLowerCase().includes(q);
  });
  const visibleLibraryFoods = filteredLibraryFoods.slice(0, libraryVisibleCount);
  const hasMoreLibraryFoods = libraryVisibleCount < filteredLibraryFoods.length;

  const handleLibraryScroll = () => {
    const el = libraryScrollRef.current;
    if (!el || !hasMoreLibraryFoods) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 150) {
      setLibraryVisibleCount((count) => Math.min(count + FOOD_LIBRARY_PAGE_SIZE, filteredLibraryFoods.length));
    }
  };

  // Purely derived from existing state — no new stored values.
  const proteinKcal = Number(plan.proteinG || 0) * 4;
  const carbsKcal = Number(plan.carbsG || 0) * 4;
  const fatKcal = Number(plan.fatG || 0) * 9;
  const macroKcalTotal = proteinKcal + carbsKcal + fatKcal;

  const totals = plan.meals.reduce(
    (acc, meal) => {
      meal.foods.forEach((food) => {
        acc.calories += Number(food.calories) || 0;
        acc.proteinG += Number(food.proteinG) || 0;
        acc.carbsG += Number(food.carbsG) || 0;
        acc.fatG += Number(food.fatG) || 0;
      });
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const pctDiff = (actual: number, target: string | number): number | null => {
    const targetNum = Number(target);
    if (!targetNum) return null;
    return ((actual - targetNum) / targetNum) * 100;
  };
  const isOffTarget = (diff: number | null) => diff != null && Math.abs(diff) > 10;

  return (
    <Card className="p-0">
      <PlanHeader title={title} subtitle={subtitle} onSave={onSave} onCreateNew={onCreateNew} saving={saving} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-130">
        {/* LEFT 70% — existing editor, layout unchanged */}
        <ResizablePanel defaultSize={70} minSize={50}>
      <div className="space-y-6 p-6 pb-24">
        <Field label="Τίτλος" value={plan.title} onChange={(value) => setPlan({ ...plan, title: value })} />

        {/* Macro targets — big kcal number + split bars + the same editable target fields */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Ημερήσιος Στόχος</div>
              <div className="mt-1 text-4xl font-bold dark:text-slate-50">
                {plan.dailyCalories || "—"} <span className="text-base font-semibold text-slate-500 dark:text-slate-400">kcal</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <MacroBar label="Πρωτεΐνη" grams={plan.proteinG} kcal={proteinKcal} totalKcal={macroKcalTotal} colorClassName="bg-blue-500" />
              <MacroBar label="Υδατάνθρακες" grams={plan.carbsG} kcal={carbsKcal} totalKcal={macroKcalTotal} colorClassName="bg-amber-500" />
              <MacroBar label="Λίπη" grams={plan.fatG} kcal={fatKcal} totalKcal={macroKcalTotal} colorClassName="bg-rose-500" />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <Field label="Θερμίδες" type="number" value={plan.dailyCalories} onChange={(value) => setPlan({ ...plan, dailyCalories: value })} />
            <Field label="Πρωτεΐνη g" type="number" value={plan.proteinG} onChange={(value) => setPlan({ ...plan, proteinG: value })} />
            <Field label="Υδατάνθρακες g" type="number" value={plan.carbsG} onChange={(value) => setPlan({ ...plan, carbsG: value })} />
            <Field label="Λίπη g" type="number" value={plan.fatG} onChange={(value) => setPlan({ ...plan, fatG: value })} />
          </div>
        </div>

        <Field label="Γενικές οδηγίες διατροφής" value={plan.notes} onChange={(value) => setPlan({ ...plan, notes: value })} />

        {plan.meals.map((meal, mealIndex) => {
          const MealIcon = MEAL_ICONS[meal.mealType] || Utensils;
          return (
            <Card key={mealIndex}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                      <MealIcon className="h-5 w-5" />
                    </span>
                    <CardTitle>{meal.title || "Γεύμα"}</CardTitle>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeMeal(mealIndex)}
                    aria-label="Διαγραφή γεύματος"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field compact label="Γεύμα" value={meal.title} onChange={(value) => updateMeal(mealIndex, { title: value })} />
                  <SelectField label="Τύπος" value={meal.mealType} onChange={(value) => updateMeal(mealIndex, { mealType: value })} options={MEAL_TYPE_OPTIONS} />
                </div>
              </CardHeader>

              <CardContent>
                <Field compact label="Οδηγίες γεύματος" value={meal.notes} onChange={(value) => updateMeal(mealIndex, { notes: value })} />

                <Collapsible defaultOpen className="mt-4">
                  <CollapsibleTrigger
                    render={
                      <button type="button" className="flex w-full items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                        <span>Τρόφιμα ({meal.foods.length})</span>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform data-panel-open:rotate-180" />
                      </button>
                    }
                  />
                  <CollapsibleContent className="mt-3">
                    <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-56">Τρόφιμο</TableHead>
                            <TableHead className="w-28">Ποσότητα</TableHead>
                            <TableHead className="w-20">Kcal</TableHead>
                            <TableHead className="w-20">Πρωτ.</TableHead>
                            <TableHead className="w-20">Υδ.</TableHead>
                            <TableHead className="w-20">Λίπη</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {meal.foods.map((food, foodIndex) => (
                            <TableRow key={foodIndex}>
                              <TableCell className="align-top">
                                <FoodPicker
                                  foods={foods}
                                  food={food}
                                  onChangeName={(value) => updateFoodName(mealIndex, foodIndex, value)}
                                  onSelectFood={(libraryFood) => selectFoodFromLibrary(mealIndex, foodIndex, libraryFood)}
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  value={food.quantity}
                                  onChange={(event) => updateFoodQuantity(mealIndex, foodIndex, event.target.value)}
                                  placeholder={food.foodId != null ? "π.χ. 150" : "π.χ. 1 φλιτζάνι"}
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  type="number"
                                  value={food.calories}
                                  onChange={(event) => updateFood(mealIndex, foodIndex, { calories: event.target.value })}
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  type="number"
                                  value={food.proteinG}
                                  onChange={(event) => updateFood(mealIndex, foodIndex, { proteinG: event.target.value })}
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  type="number"
                                  value={food.carbsG}
                                  onChange={(event) => updateFood(mealIndex, foodIndex, { carbsG: event.target.value })}
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  type="number"
                                  value={food.fatG}
                                  onChange={(event) => updateFood(mealIndex, foodIndex, { fatG: event.target.value })}
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeFood(mealIndex, foodIndex)}
                                  aria-label="Διαγραφή τροφίμου"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addFood(mealIndex)}
                      className="mt-3 h-9 gap-2 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 dark:text-slate-200 dark:hover:border-red-500/30 dark:hover:text-red-400"
                    >
                      <Plus className="h-4 w-4" />
                      Προσθήκη τροφίμου
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}

        <Button type="button" variant="outline" onClick={addMeal} className="h-11 gap-2 px-5 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 dark:text-slate-200 dark:hover:border-red-500/30 dark:hover:text-red-400">
          <Plus className="h-4 w-4" />
          Προσθήκη γεύματος
        </Button>

        <PlanHistory rows={history} countLabel={(row) => (row.daily_calories ? `${row.daily_calories} kcal` : "-")} />
      </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT 30% — food library, new */}
        <ResizablePanel defaultSize={30} minSize={22} className="flex flex-col overflow-hidden border-l border-slate-200 dark:border-slate-800">
          <div className="space-y-3 border-b border-slate-200 p-3 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
                placeholder="Αναζήτηση τροφίμου..."
                className="h-10 pl-9 text-sm font-semibold"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FOOD_LIBRARY_CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setLibraryCategory(category.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-bold transition-colors",
                    libraryCategory === category.key
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          <div
            ref={libraryScrollRef}
            onScroll={handleLibraryScroll}
            className="max-h-[32rem] flex-1 overflow-y-auto"
          >
            {visibleLibraryFoods.map((food) => (
              <LibraryFoodRow key={food.id} food={food} meals={plan.meals} onAddToMeal={(mealIndex) => addFoodFromLibrary(mealIndex, food)} />
            ))}
            {hasMoreLibraryFoods && (
              <div className="p-3 text-center text-xs font-bold text-slate-400 dark:text-slate-500">Φόρτωση περισσότερων...</div>
            )}
            {!filteredLibraryFoods.length && (
              <div className="p-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν βρέθηκε τρόφιμο.</div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Sticky bottom summary bar — totals vs targets, purely derived from existing state */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <SummaryStat label="Θερμίδες" actual={totals.calories} target={plan.dailyCalories} unit="kcal" diff={pctDiff(totals.calories, plan.dailyCalories)} isOffTarget={isOffTarget} />
        <SummaryStat label="Πρωτεΐνη" actual={totals.proteinG} target={plan.proteinG} unit="g" diff={pctDiff(totals.proteinG, plan.proteinG)} isOffTarget={isOffTarget} />
        <SummaryStat label="Υδατάνθρακες" actual={totals.carbsG} target={plan.carbsG} unit="g" diff={pctDiff(totals.carbsG, plan.carbsG)} isOffTarget={isOffTarget} />
        <SummaryStat label="Λίπη" actual={totals.fatG} target={plan.fatG} unit="g" diff={pctDiff(totals.fatG, plan.fatG)} isOffTarget={isOffTarget} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New presentational helpers
// ---------------------------------------------------------------------------

function MacroBar({
  label,
  grams,
  kcal,
  totalKcal,
  colorClassName,
}: {
  label: string;
  grams: string | number;
  kcal: number;
  totalKcal: number;
  colorClassName: string;
}) {
  const pct = totalKcal > 0 ? (kcal / totalKcal) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span>
          {grams || 0}g · {Math.round(pct)}%
        </span>
      </div>
      <Progress value={pct} indicatorClassName={colorClassName} className="mt-1" />
    </div>
  );
}

function SummaryStat({
  label,
  actual,
  target,
  unit,
  diff,
  isOffTarget,
}: {
  label: string;
  actual: number;
  target: string | number;
  unit: string;
  diff: number | null;
  isOffTarget: (diff: number | null) => boolean;
}) {
  const off = isOffTarget(diff);
  return (
    <div className="flex items-center gap-2">
      <div className="text-sm">
        <span className="font-bold text-slate-900 dark:text-slate-50">{round1(actual)}</span>
        <span className="text-slate-500 dark:text-slate-400"> / {target || "—"} {unit}</span>
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
      </div>
      {off && (
        <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {diff != null && diff > 0 ? "Υπέρβαση" : "Έλλειψη"}
        </Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: FoodPicker — search-and-select over the food library, layered on top
// of the food name text field without changing its persistence guarantee:
// the name is always a live, directly-controlled value (exactly like the
// original plain Field), so freeform typing (foods not in the library)
// still saves immediately, same as before this redesign. Selecting a
// suggestion additionally attaches foodId + scaled macros.
// ---------------------------------------------------------------------------

function FoodPicker({
  foods,
  food,
  onChangeName,
  onSelectFood,
}: {
  foods: LibraryFood[];
  food: FoodEntry;
  onChangeName: (value: string) => void;
  onSelectFood: (food: LibraryFood) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = food.foodName.trim().toLowerCase();
  const filtered = query
    ? foods.filter((item) => [item.nameGr, item.nameEn, item.category].join(" ").toLowerCase().includes(query)).slice(0, 8)
    : [];

  const choose = (item: LibraryFood) => {
    onSelectFood(item);
    setOpen(false);
  };

  return (
    <div className="relative min-w-48">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          value={food.foodName}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => onChangeName(event.target.value)}
          placeholder="Τρόφιμο..."
          className="h-9 pl-8 text-sm"
        />
      </div>
      {food.foodId != null && (
        <Badge variant="secondary" className="mt-1 text-[10px]">
          Από βιβλιοθήκη
        </Badge>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-10 z-30 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              className={cn(
                "flex w-full items-center gap-2.5 border-b border-slate-100 px-2.5 py-2 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800",
              )}
            >
              <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(item.imageUrl)} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-slate-950 dark:text-slate-50">{item.nameGr}</span>
                <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {item.caloriesPer100g ?? "—"} kcal/100g
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: LibraryFoodRow — one row in the right-panel food library. The "+"
// opens a popover listing meals; picking one calls the existing
// addFoodFromLibrary(mealIndex, food) unchanged.
// ---------------------------------------------------------------------------

function LibraryFoodRow({
  food,
  meals,
  onAddToMeal,
}: {
  food: LibraryFood;
  meals: MealEntry[];
  onAddToMeal: (mealIndex: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
        {food.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(food.imageUrl)} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{food.nameGr}</span>
        <span className="block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          {food.caloriesPer100g ?? "—"} kcal · P:{food.proteinPer100g ?? "—"} C:{food.carbsPer100g ?? "—"} F:{food.fatsPer100g ?? "—"}
        </span>
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Προσθήκη σε γεύμα"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            />
          }
        >
          <Plus className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2">
          <div className="px-1 pb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Προσθήκη σε ποιο γεύμα;</div>
          <div className="flex flex-col gap-1">
            {meals.map((meal, mealIndex) => (
              <button
                key={mealIndex}
                type="button"
                onClick={() => {
                  onAddToMeal(mealIndex);
                  setOpen(false);
                }}
                className="rounded-md px-2 py-1.5 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {meal.title || `Γεύμα ${mealIndex + 1}`}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
