"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Plus, Search, GripVertical, ChevronDown } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { resolveMediaUrl } from "@/lib/media";
import { Field, PlanHeader, PlanHistory, SelectField, type PlanHistoryRow } from "@/components/shared/plan-editor-ui";

// ---------------------------------------------------------------------------
// Types, defaults, normalize — UNCHANGED from the current file
// ---------------------------------------------------------------------------

const dayLabels = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

// ---------------------------------------------------------------------------
// NEW: right-panel library filter tabs. Raw muscle-group values in the data
// are granular (e.g. "Τετρακέφαλοι", "Οπίσθιοι Μηριαίοι"), so each broad tab
// matches by keyword substring rather than an exact value.
// ---------------------------------------------------------------------------

const LIBRARY_MUSCLE_FILTERS: { key: string; label: string; keywords: string[] | null }[] = [
  { key: "all", label: "Όλα", keywords: null },
  { key: "chest", label: "Στήθος", keywords: ["στήθ"] },
  { key: "back", label: "Πλάτη", keywords: ["πλάτ", "τραπεζοειδ"] },
  { key: "legs", label: "Πόδια", keywords: ["μηριαί", "τετρακέφαλ", "γάμπ", "γλουτ", "προσαγωγ", "απαγωγ"] },
  { key: "shoulders", label: "Ώμοι", keywords: ["ώμ", "αυχέν"] },
  { key: "arms", label: "Χέρια", keywords: ["δικέφαλ", "τρικέφαλ", "πήχ"] },
  { key: "core", label: "Κορμός", keywords: ["κοιλιακ", "κορμ"] },
  { key: "cardio", label: "Καρδιο", keywords: ["καρδιο", "αερόβι"] },
];

const LIBRARY_PAGE_SIZE = 20;

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

// ---------------------------------------------------------------------------
// TrainingPlanEditor — same props, same public API. New internals below.
// ---------------------------------------------------------------------------

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

  // ---- NEW (right-panel library performance): debounced search + muscle filter + pagination ----
  const [libraryQuery, setLibraryQuery] = useState("");
  const [debouncedLibraryQuery, setDebouncedLibraryQuery] = useState("");
  const [libraryMuscleFilter, setLibraryMuscleFilter] = useState("all");
  const [libraryVisibleCount, setLibraryVisibleCount] = useState(LIBRARY_PAGE_SIZE);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedLibraryQuery(libraryQuery), 300);
    return () => window.clearTimeout(timeoutId);
  }, [libraryQuery]);

  useEffect(() => {
    setLibraryVisibleCount(LIBRARY_PAGE_SIZE);
  }, [debouncedLibraryQuery, libraryMuscleFilter]);

  const visibleDays = (plan.days || []).slice(0, plan.dayCount || plan.days?.length || 1);
  const selectedDay = visibleDays[activeDayIndex] || visibleDays[0];
  const muscleGroups = [...new Set((selectedDay?.exercises || []).map((exercise) => exercise.muscleGroup).filter(Boolean))];
  const isRestDay = (selectedDay?.exercises?.length ?? 0) === 0;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // ---- existing functions, UNCHANGED ----
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

  // ---- NEW #1 (approved): rest-day toggle reuses updateDay, no new state shape ----
  const toggleRestDay = (checked: boolean) => {
    if (checked) updateDay(activeDayIndex, { exercises: [] });
    // turning it back off just leaves the (empty) day visible to add exercises to
  };

  // ---- NEW #2 (approved): library click = addExercise + updateExercise in one step ----
  const addExerciseFromLibrary = (item: LibraryExercise) => {
    updateDay(activeDayIndex, {
      exercises: [
        ...(plan.days[activeDayIndex]?.exercises || []),
        {
          exerciseId: item.id || "",
          exerciseName: item.name || "",
          muscleGroup: item.muscleGroup || "",
          imageUrl: item.imageUrl || item.image_url || "",
          videoUrl: item.videoUrl || item.video_url || "",
          sets: "",
          reps: "",
          tempo: "",
          restSeconds: "",
          targetWeight: "",
          notes: "",
        },
      ],
    });
  };

  // ---- NEW #3 (approved): drag-reorder within the active day, PLUS drag-from-library ----
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || !selectedDay) return;

    const activeId = String(active.id);

    // Dropped a library exercise onto the day area — same helper as the click-to-add path.
    if (activeId.startsWith("lib-")) {
      const libraryId = activeId.slice(4);
      const item = exercises.find((candidate) => String(candidate.id) === libraryId);
      if (item) addExerciseFromLibrary(item);
      return;
    }

    // Otherwise it's a reorder within the day's own exercise list.
    if (active.id === over.id) return;
    const ids = selectedDay.exercises.map((_, index) => `ex-${index}`);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    updateDay(activeDayIndex, { exercises: arrayMove(selectedDay.exercises, oldIndex, newIndex) });
  };

  const draggedLibraryItem = activeDragId?.startsWith("lib-")
    ? exercises.find((item) => String(item.id) === activeDragId.slice(4))
    : null;
  const draggedExercise = activeDragId?.startsWith("ex-")
    ? selectedDay?.exercises[Number(activeDragId.slice(3))]
    : null;

  // The day list sits inside a droppable wrapper (DayDropZone) so drops always have
  // somewhere to land, even on an empty day. But that means the pointer is often
  // simultaneously "within" both the wrapper AND the specific exercise card under it,
  // and plain pointerWithin isn't guaranteed to prefer the more specific one — which
  // silently broke reordering (over.id resolved to "day-dropzone" instead of the card).
  // Prefer a direct hit on an exercise card; otherwise fall back to closestCenter so
  // dropping into empty space (or an empty day) still resolves to something sensible.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args).filter((collision) => String(collision.id).startsWith("ex-"));
    if (pointerHits.length > 0) return pointerHits;
    return closestCenter(args);
  };

  const activeMuscleFilter = LIBRARY_MUSCLE_FILTERS.find((filter) => filter.key === libraryMuscleFilter);

  const filteredLibrary = useMemo(() => {
    const q = debouncedLibraryQuery.trim().toLowerCase();
    return exercises.filter((item) => {
      if (q) {
        const haystack = [item.name, item.muscleGroup, item.equipment, item.type].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (activeMuscleFilter?.keywords) {
        const muscleGroup = (item.muscleGroup || "").toLowerCase();
        if (!activeMuscleFilter.keywords.some((keyword) => muscleGroup.includes(keyword))) return false;
      }
      return true;
    });
  }, [exercises, debouncedLibraryQuery, activeMuscleFilter]);

  // Only render a page at a time — the library can hold hundreds of exercises,
  // and mounting every row (each with an image) at once is what was slow.
  const visibleLibrary = filteredLibrary.slice(0, libraryVisibleCount);
  const hasMoreLibraryItems = libraryVisibleCount < filteredLibrary.length;
  const libraryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (libraryScrollRef.current) libraryScrollRef.current.scrollTop = 0;
  }, [debouncedLibraryQuery, libraryMuscleFilter]);

  const handleLibraryScroll = () => {
    const el = libraryScrollRef.current;
    if (!el || !hasMoreLibraryItems) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setLibraryVisibleCount((count) => Math.min(count + LIBRARY_PAGE_SIZE, filteredLibrary.length));
    }
  };

  return (
    <Card className="p-0">
      <PlanHeader title={title} subtitle={subtitle} onSave={onSave} onCreateNew={onCreateNew} saving={saving} />

      <div className="space-y-6 p-6">
        {/* Top fields row — same 4 fields/handlers as before, just re-flowed */}
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

        {/* Day selector — now real shadcn Tabs, wired to the same activeDayIndex state */}
        <Tabs value={String(activeDayIndex)} onValueChange={(value) => value && setActiveDayIndex(Number(value))}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {visibleDays.map((day, index) => (
              <TabsTrigger key={`${day.dayOfWeek}-${index}`} value={String(index)}>
                Ημέρα {index + 1}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={String(activeDayIndex)} className="mt-4">
            {selectedDay && (
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetection}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <ResizablePanelGroup orientation="horizontal" className="min-h-130 rounded-lg border border-slate-200 dark:border-slate-800">
                  {/* LEFT 70% — day builder */}
                  <ResizablePanel defaultSize="70" minSize="50" className="flex flex-col overflow-hidden">
                    <div className="flex flex-col gap-4 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Switch checked={isRestDay} onCheckedChange={toggleRestDay} />
                          <Label className="text-sm font-bold">Ημέρα ξεκούρασης</Label>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addExercise(activeDayIndex)}
                          className="h-9 gap-2 text-sm font-bold"
                        >
                          <Plus className="h-4 w-4" />
                          Προσθήκη άσκησης
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {muscleGroups.length ? (
                          muscleGroups.map((group) => (
                            <Badge key={group} variant="secondary">
                              {group}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Οι μυϊκές ομάδες θα μπουν αυτόματα από τις ασκήσεις.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                      {!isRestDay && (
                        <SortableContext
                          items={selectedDay.exercises.map((_, index) => `ex-${index}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          <DayDropZone>
                            {selectedDay.exercises.map((exercise, exerciseIndex) => (
                              <SortableExerciseCard
                                key={`ex-${exerciseIndex}`}
                                id={`ex-${exerciseIndex}`}
                                exercise={exercise}
                                exercises={exercises}
                                onChange={(patch) => updateExercise(activeDayIndex, exerciseIndex, patch)}
                                onRemove={() => removeExercise(activeDayIndex, exerciseIndex)}
                              />
                            ))}
                            {!selectedDay.exercises.length && (
                              <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                Σύρε μια άσκηση από τη βιβλιοθήκη ή πάτησε &quot;Προσθήκη άσκησης&quot;.
                              </div>
                            )}
                          </DayDropZone>
                        </SortableContext>
                      )}

                      {isRestDay && (
                        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                          Ημέρα ξεκούρασης — χωρίς ασκήσεις.
                        </div>
                      )}
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* RIGHT 30% — exercise library */}
                  <ResizablePanel defaultSize="30" minSize="22" className="flex flex-col overflow-hidden border-l border-slate-200 dark:border-slate-800">
                    <div className="space-y-3 border-b border-slate-200 p-3 dark:border-slate-800">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={libraryQuery}
                          onChange={(event) => setLibraryQuery(event.target.value)}
                          placeholder="Αναζήτηση στη βιβλιοθήκη..."
                          className="h-10 pl-9 text-sm font-semibold"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {LIBRARY_MUSCLE_FILTERS.map((filter) => (
                          <button
                            key={filter.key}
                            type="button"
                            onClick={() => setLibraryMuscleFilter(filter.key)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-bold transition-colors",
                              libraryMuscleFilter === filter.key
                                ? "border-red-500 bg-red-500 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            )}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      ref={libraryScrollRef}
                      onScroll={handleLibraryScroll}
                      className="max-h-[32rem] flex-1 overflow-y-auto"
                    >
                      {visibleLibrary.map((item) => (
                        <DraggableLibraryItem key={item.id} item={item} onClick={() => addExerciseFromLibrary(item)} />
                      ))}
                      {hasMoreLibraryItems && (
                        <div className="p-3 text-center text-xs font-bold text-slate-400 dark:text-slate-500">Φόρτωση περισσότερων...</div>
                      )}
                      {!filteredLibrary.length && (
                        <div className="p-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν βρέθηκε άσκηση.</div>
                      )}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>

                <DragOverlay>
                  {draggedLibraryItem && <LibraryItemPreview item={draggedLibraryItem} />}
                  {draggedExercise && <ExercisePreviewCard exercise={draggedExercise} />}
                </DragOverlay>
              </DndContext>
            )}
          </TabsContent>
        </Tabs>

        <Field label="Γενικές σημειώσεις προγράμματος" value={plan.description} onChange={(value) => setPlan({ ...plan, description: value })} />

        <PlanHistory rows={history} countLabel={(row) => `${row.day_count ?? 0} ημέρες, ${row.exercise_count ?? 0} ασκήσεις`} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// NEW: one exercise card, sortable via dnd-kit. Same fields/handlers as before,
// plus Weight + Notes inputs (both already existed on TrainingExerciseEntry,
// just never had a JSX input rendered for them until now).
// ---------------------------------------------------------------------------

function SortableExerciseCard({
  id,
  exercise,
  exercises,
  onChange,
  onRemove,
}: {
  id: string;
  exercise: TrainingExerciseEntry;
  exercises: LibraryExercise[];
  onChange: (patch: Partial<TrainingExerciseEntry>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [notesOpen, setNotesOpen] = useState(Boolean(exercise.notes));

  return (
    // The sortable ref goes on a plain div we control directly, not on <Card> —
    // Card doesn't declare `ref` in its own props (it only destructures
    // className/size before spreading the rest), so this is the one path in the
    // app that actually needs a guaranteed-attached DOM node for dnd-kit to
    // measure and animate. Routing it through Card was silently breaking drag.
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <Card className={`group/exercise p-3 ${isDragging ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2 cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300"
          aria-label="Μετακίνηση άσκησης"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {exercise.imageUrl && (
          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(exercise.imageUrl)} alt="" className="h-full w-full object-cover" />
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <ExercisePicker
              exercises={exercises}
              value={exercise}
              onSelect={(selected) =>
                onChange({
                  exerciseId: selected?.id || "",
                  exerciseName: selected?.name || "",
                  muscleGroup: selected?.muscleGroup || "",
                  imageUrl: selected?.imageUrl || selected?.image_url || "",
                  videoUrl: selected?.videoUrl || selected?.video_url || "",
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              className="opacity-0 transition-opacity group-hover/exercise:opacity-100"
              aria-label="Διαγραφή άσκησης"
            >
              ✕
            </Button>
          </div>

          {exercise.muscleGroup && <Badge variant="secondary">{exercise.muscleGroup}</Badge>}

          <div className="grid grid-cols-4 gap-2">
            <Field compact label="Σετ" value={exercise.sets} onChange={(value) => onChange({ sets: value })} />
            <Field compact label="Επαναλ." value={exercise.reps} onChange={(value) => onChange({ reps: value })} />
            <Field compact label="Βάρος" value={exercise.targetWeight} onChange={(value) => onChange({ targetWeight: value })} />
            <Field compact label="Rest" value={exercise.restSeconds} onChange={(value) => onChange({ restSeconds: value })} />
          </div>

          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger
              render={
                <button type="button" className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${notesOpen ? "rotate-180" : ""}`} />
                  Σημειώσεις
                </button>
              }
            />
            <CollapsibleContent>
              <Textarea
                value={exercise.notes}
                onChange={(event) => onChange({ notes: event.target.value })}
                placeholder="π.χ. τεχνική, εναλλακτική άσκηση..."
                className="mt-2"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW: drag-and-drop plumbing — a droppable wrapper for the day's exercise
// list, a draggable library row, and the floating previews shown while
// dragging (dnd-kit renders the dragged element in place as normal, so a
// DragOverlay preview is what actually follows the cursor).
// ---------------------------------------------------------------------------

function DayDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "day-dropzone" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-3 rounded-md p-1 transition-colors",
        isOver && "bg-red-50/60 ring-2 ring-red-300 dark:bg-red-500/10 dark:ring-red-500/40"
      )}
    >
      {children}
    </div>
  );
}

function DraggableLibraryItem({ item, onClick }: { item: LibraryExercise; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib-${item.id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      {...listeners}
      {...attributes}
      className={cn(
        "flex w-full cursor-grab touch-none items-center gap-3 border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 active:cursor-grabbing dark:border-slate-800 dark:hover:bg-slate-800",
        isDragging && "opacity-30"
      )}
    >
      <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
        {item.imageUrl || item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(item.imageUrl || item.image_url)} alt="" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{item.name}</span>
        {item.muscleGroup && (
          <Badge variant="outline" className="mt-1">
            {item.muscleGroup}
          </Badge>
        )}
      </span>
    </button>
  );
}

function LibraryItemPreview({ item }: { item: LibraryExercise }) {
  return (
    <div className="flex w-64 items-center gap-3 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
        {item.imageUrl || item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(item.imageUrl || item.image_url)} alt="" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span className="truncate text-sm font-bold">{item.name}</span>
    </div>
  );
}

function ExercisePreviewCard({ exercise }: { exercise: TrainingExerciseEntry }) {
  return (
    <div className="flex w-64 items-center gap-3 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
      {exercise.imageUrl && (
        <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveMediaUrl(exercise.imageUrl)} alt="" className="h-full w-full object-cover" />
        </span>
      )}
      <span className="truncate text-sm font-bold">{exercise.exerciseName || "Άσκηση"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExercisePicker — UNCHANGED (still the per-row way to pick/change an exercise)
// ---------------------------------------------------------------------------

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
    <div className="relative block flex-1">
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
