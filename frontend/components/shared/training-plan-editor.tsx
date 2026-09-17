"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveMediaUrl } from "@/lib/media";
import { Field, PlanHeader, PlanHistory, SelectField, type PlanHistoryRow } from "@/components/shared/plan-editor-ui";

const dayLabels = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

export interface LibraryExercise {
  id: number | string;
  name?: string;
  muscleGroup?: string;
  equipment?: string;
  type?: string;
  imageUrl?: string;
  image_url?: string;
  videoUrl?: string;
  video_url?: string;
}

export interface TrainingExerciseEntry {
  exerciseId: string | number;
  exerciseName: string;
  muscleGroup: string;
  imageUrl: string;
  videoUrl: string;
  sets: string | number;
  reps: string | number;
  tempo: string;
  restSeconds: string | number;
  targetWeight: string | number;
  notes: string;
}

export interface TrainingDayEntry {
  dayOfWeek: number;
  title: string;
  notes: string;
  exercises: TrainingExerciseEntry[];
}

export interface TrainingPlanState {
  title: string;
  description: string;
  durationWeeks: number | string;
  difficulty: string;
  dayCount?: number;
  days: TrainingDayEntry[];
  templateId?: number | string | null;
  templateTitle?: string | null;
}

export interface RawTrainingExercise {
  exercise_id?: string | number;
  exerciseId?: string | number;
  exercise_name?: string;
  exerciseName?: string;
  muscle_group?: string;
  muscleGroup?: string;
  image_url?: string;
  imageUrl?: string;
  video_url?: string;
  videoUrl?: string;
  sets?: string | number;
  reps?: string | number;
  tempo?: string;
  rest_seconds?: string | number;
  restSeconds?: string | number;
  target_weight?: string | number;
  targetWeight?: string | number;
  notes?: string;
}

export interface RawTrainingDay {
  day_of_week?: number;
  dayOfWeek?: number;
  title?: string;
  notes?: string;
  exercises?: RawTrainingExercise[];
}

export interface RawTrainingPlan {
  id?: number | string;
  days?: RawTrainingDay[];
  day_count?: number;
  dayCount?: number;
  title?: string;
  description?: string;
  duration_weeks?: number | string;
  durationWeeks?: number | string;
  difficulty?: string;
  goal?: string;
  level?: string;
  days_per_week?: number;
  template_id?: number | string | null;
  template_title?: string | null;
}

export function emptyTrainingDay(dayOfWeek: number): TrainingDayEntry {
  return {
    dayOfWeek,
    title: dayLabels[dayOfWeek],
    notes: "",
    exercises: [],
  };
}

export function defaultTrainingPlan(): TrainingPlanState {
  return {
    title: "Πρόγραμμα Προπόνησης",
    description: "",
    durationWeeks: 4,
    difficulty: "intermediate",
    days: [1, 2, 3, 4, 5, 6, 0].map(emptyTrainingDay),
  };
}

export function normalizeTrainingPlan(plan?: RawTrainingPlan | null): TrainingPlanState {
  const base = defaultTrainingPlan();
  if (!plan?.id && !plan?.days?.length) return base;
  const daysByWeek = new Map((plan.days || []).map((day) => [Number(day.day_of_week ?? day.dayOfWeek), day]));
  const dayCount = Number(plan.day_count || plan.dayCount || plan.days?.length || base.days.length);

  return {
    title: plan.title || base.title,
    description: plan.description || "",
    durationWeeks: plan.duration_weeks || plan.durationWeeks || 4,
    difficulty: plan.difficulty || plan.level || "intermediate",
    dayCount,
    templateId: plan.template_id ?? null,
    templateTitle: plan.template_title ?? null,
    days: base.days.slice(0, dayCount).map((defaultDay) => {
      const source = daysByWeek.get(defaultDay.dayOfWeek);
      return {
        dayOfWeek: defaultDay.dayOfWeek,
        title: source?.title || defaultDay.title,
        notes: source?.notes || "",
        exercises: (source?.exercises || []).map((exercise) => ({
          exerciseId: exercise.exercise_id || exercise.exerciseId || "",
          exerciseName: exercise.exercise_name || exercise.exerciseName || "",
          muscleGroup: exercise.muscle_group || exercise.muscleGroup || "",
          imageUrl: exercise.image_url || exercise.imageUrl || "",
          videoUrl: exercise.video_url || exercise.videoUrl || "",
          sets: exercise.sets || "",
          reps: exercise.reps || "",
          tempo: exercise.tempo || "",
          restSeconds: exercise.rest_seconds || exercise.restSeconds || "",
          targetWeight: exercise.target_weight || exercise.targetWeight || "",
          notes: exercise.notes || "",
        })),
      };
    }),
  };
}

export function TrainingPlanEditor({
  plan,
  setPlan,
  exercises,
  onSave,
  onCreateNew,
  saving,
  history = [],
  title = "Πρόγραμμα Προπόνησης",
  subtitle = "Διάλεξε ημέρες, βάλε ασκήσεις από τη βιβλιοθήκη και συμπλήρωσε Σετ, Επαναλ., Tempo και Rest.",
}: {
  plan: TrainingPlanState;
  setPlan: Dispatch<SetStateAction<TrainingPlanState>>;
  exercises: LibraryExercise[];
  onSave: () => void;
  onCreateNew?: () => void;
  saving: boolean;
  history?: PlanHistoryRow[];
  title?: string;
  subtitle?: string;
}) {
  const initialIndex = plan.days?.findIndex((day) => day.exercises?.length) ?? 0;
  const [activeDayIndex, setActiveDayIndex] = useState(Math.max(0, initialIndex));
  const visibleDays = (plan.days || []).slice(0, plan.dayCount || plan.days?.length || 1);
  const selectedDay = visibleDays[activeDayIndex] || visibleDays[0];
  const muscleGroups = [...new Set((selectedDay?.exercises || []).map((exercise) => exercise.muscleGroup).filter(Boolean))];

  const setDayCount = (count: number) => {
    const nextCount = Number(count);
    setPlan((current) => {
      const nextDays = [...current.days];
      while (nextDays.length < nextCount) {
        const dayOfWeek = nextDays.length + 1 > 6 ? 0 : nextDays.length + 1;
        nextDays.push(emptyTrainingDay(dayOfWeek));
      }
      return { ...current, dayCount: nextCount, days: nextDays.slice(0, nextCount) };
    });
    setActiveDayIndex((index) => Math.min(index, nextCount - 1));
  };

  const updateDay = (dayIndex: number, patch: Partial<TrainingDayEntry>) => {
    setPlan((current) => ({
      ...current,
      days: current.days.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)),
    }));
  };

  const addExercise = (dayIndex: number) => {
    updateDay(dayIndex, {
      exercises: [
        ...(plan.days[dayIndex]?.exercises || []),
        { exerciseId: "", exerciseName: "", muscleGroup: "", imageUrl: "", videoUrl: "", sets: "", reps: "", tempo: "", restSeconds: "", targetWeight: "", notes: "" },
      ],
    });
  };

  const updateExercise = (dayIndex: number, exerciseIndex: number, patch: Partial<TrainingExerciseEntry>) => {
    const day = plan.days[dayIndex];
    updateDay(dayIndex, {
      exercises: day.exercises.map((exercise, index) => (index === exerciseIndex ? { ...exercise, ...patch } : exercise)),
    });
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const day = plan.days[dayIndex];
    updateDay(dayIndex, { exercises: day.exercises.filter((_, index) => index !== exerciseIndex) });
  };

  return (
    <Card className="p-0">
      <PlanHeader title={title} subtitle={subtitle} onSave={onSave} onCreateNew={onCreateNew} saving={saving} />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.7fr_0.7fr_1fr]">
          <Field label="Τίτλος" value={plan.title} onChange={(value) => setPlan({ ...plan, title: value })} />
          <div className="block">
            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Ημέρες προγράμματος</Label>
            <Select
              items={[1, 2, 3, 4, 5, 6, 7].map((count) => ({ value: String(count), label: `${count} ημέρες` }))}
              value={String(plan.dayCount || visibleDays.length)}
              onValueChange={(value) => setDayCount(Number(value ?? 0))}
            >
              <SelectTrigger className="mt-1 h-11 w-full text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} ημέρες
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SelectField
            label="Επίπεδο"
            value={plan.difficulty}
            onChange={(value) => setPlan({ ...plan, difficulty: value })}
            options={[
              ["beginner", "Αρχάριο"],
              ["intermediate", "Μεσαίο"],
              ["advanced", "Προχωρημένο"],
            ]}
          />
          <Field label="Διάρκεια εβδομάδες" type="number" value={plan.durationWeeks} onChange={(value) => setPlan({ ...plan, durationWeeks: value })} />
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800">
          {visibleDays.map((day, index) => {
            const groups = [...new Set((day.exercises || []).map((exercise) => exercise.muscleGroup).filter(Boolean))];
            return (
              <Button
                key={`${day.dayOfWeek}-${index}`}
                type="button"
                variant={activeDayIndex === index ? "default" : "outline"}
                onClick={() => setActiveDayIndex(index)}
                className="h-auto min-w-33 flex-col items-start whitespace-normal px-4 py-3 text-left"
              >
                <div className="text-sm font-bold">Ημέρα {index + 1}</div>
                <div className={`mt-1 truncate text-xs font-bold ${activeDayIndex === index ? "text-white/90" : "text-slate-500 dark:text-slate-400"}`}>
                  {groups.length ? groups.join(" / ") : "Χωρίς ασκήσεις"}
                </div>
              </Button>
            );
          })}
        </div>

        {selectedDay && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-bold">Ημέρα {activeDayIndex + 1}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {muscleGroups.length ? (
                    muscleGroups.map((group) => (
                      <span key={group} className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        {group}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Οι μυϊκές ομάδες θα μπουν αυτόματα από τις ασκήσεις.</span>
                  )}
                </div>
              </div>
              <Button type="button" onClick={() => addExercise(activeDayIndex)} className="h-10 gap-2 bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">
                <Plus className="h-4 w-4" />
                Προσθήκη άσκησης
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {(selectedDay.exercises || []).map((exercise, exerciseIndex) => (
                <div
                  key={`${selectedDay.dayOfWeek}-${exerciseIndex}`}
                  className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[minmax(240px,2fr)_88px_100px_100px_96px_auto] dark:border-slate-800 dark:bg-slate-900"
                >
                  <ExercisePicker
                    exercises={exercises}
                    value={exercise}
                    onSelect={(selected) =>
                      updateExercise(activeDayIndex, exerciseIndex, {
                        exerciseId: selected?.id || "",
                        exerciseName: selected?.name || "",
                        muscleGroup: selected?.muscleGroup || "",
                        imageUrl: selected?.imageUrl || selected?.image_url || "",
                        videoUrl: selected?.videoUrl || selected?.video_url || "",
                      })
                    }
                  />
                  <Field compact label="Σετ" value={exercise.sets} onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { sets: value })} />
                  <Field compact label="Επαναλ." value={exercise.reps} onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { reps: value })} />
                  <Field compact label="Tempo" value={exercise.tempo} onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { tempo: value })} />
                  <Field
                    compact
                    label="Rest"
                    value={exercise.restSeconds}
                    onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { restSeconds: value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeExercise(activeDayIndex, exerciseIndex)}
                    className="h-auto self-end border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Διαγραφή
                  </Button>
                </div>
              ))}
              {!selectedDay.exercises?.length && (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Πρόσθεσε την πρώτη άσκηση για αυτή την ημέρα.
                </div>
              )}
            </div>
          </div>
        )}

        <Field label="Γενικές σημειώσεις προγράμματος" value={plan.description} onChange={(value) => setPlan({ ...plan, description: value })} />

        <PlanHistory rows={history} countLabel={(row) => `${row.day_count ?? 0} ημέρες, ${row.exercise_count ?? 0} ασκήσεις`} />
      </div>
    </Card>
  );
}

export function ExercisePicker({
  exercises,
  value,
  onSelect,
}: {
  exercises: LibraryExercise[];
  value: TrainingExerciseEntry;
  onSelect: (exercise: LibraryExercise | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedLabel = value?.exerciseName || "";
  const searchValue = open ? query : selectedLabel;
  const normalizedQuery = searchValue.trim().toLowerCase();
  const filteredExercises = (exercises || [])
    .filter((item) => {
      if (!normalizedQuery) return true;
      return [item.name, item.muscleGroup, item.equipment, item.type].join(" ").toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 12);

  const chooseExercise = (exercise: LibraryExercise) => {
    onSelect(exercise);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative block">
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Άσκηση</Label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          value={searchValue}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="Αναζήτηση άσκησης..."
          className="h-10 pl-9 text-sm font-semibold"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-15.5 z-30 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {filteredExercises.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseExercise(item)}
              className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none border-b border-slate-100 px-3 py-3 text-left last:border-b-0 dark:border-slate-800"
            >
              <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                {item.imageUrl || item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(item.imageUrl || item.image_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">PHOTO</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-950 dark:text-slate-50">{item.name}</span>
                <span className="mt-1 block truncate text-xs font-bold text-slate-500 dark:text-slate-400">{item.muscleGroup || "Χωρίς μυϊκή ομάδα"}</span>
              </span>
              {item.equipment && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{item.equipment}</span>}
            </Button>
          ))}
          {!filteredExercises.length && <div className="px-3 py-4 text-center text-sm font-bold text-slate-500 dark:text-slate-400">Δεν βρέθηκε άσκηση.</div>}
        </div>
      )}
    </div>
  );
}
