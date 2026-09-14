"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Clock, Flame, LayoutGrid, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveMediaUrl } from "@/lib/media";

const dayNames = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

interface RawExerciseImage {
  id?: string | number;
  imageUrl?: string;
  image_url?: string;
  url?: string;
  altText?: string;
  alt_text?: string;
  isPrimary?: boolean;
  is_primary?: boolean;
}

interface ExerciseImage {
  id: string | number;
  imageUrl: string;
  altText: string;
  isPrimary: boolean;
}

interface RawExercise {
  id?: string | number;
  exercise_id?: string | number;
  exerciseId?: string | number;
  exercise_name?: string;
  exerciseName?: string;
  name?: string;
  muscle_group?: string;
  muscleGroup?: string;
  primary_muscle_group?: string;
  image_url?: string;
  imageUrl?: string;
  thumbnail_url?: string;
  images?: RawExerciseImage[];
  imageUrls?: string[];
  video_url?: string;
  videoUrl?: string;
  sets?: string | number;
  reps?: string | number;
  tempo?: string;
  rest_seconds?: string | number;
  restSeconds?: string | number;
  rest?: string | number;
  notes?: string;
}

interface Exercise {
  id: string | number;
  name: string;
  muscle: string;
  image: string;
  images: ExerciseImage[];
  video: string;
  sets: string | number;
  reps: string | number;
  tempo: string;
  rest: string | number;
  notes: string;
}

interface RawDay {
  id?: string | number;
  day_of_week?: number;
  dayOfWeek?: number;
  title?: string;
  notes?: string;
  exercises?: RawExercise[];
}

interface Day {
  id: string | number;
  dayOfWeek: number;
  title: string;
  notes: string;
  exercises: Exercise[];
}

export interface TrainingProgram {
  title?: string;
  description?: string;
  difficulty?: string;
  days?: RawDay[];
}

function normalizeExerciseImages(exercise: Partial<RawExercise> & { imageUrl?: string } = {}): ExerciseImage[] {
  const rawImages = Array.isArray(exercise.images) ? exercise.images : [];
  const urlImages: RawExerciseImage[] = Array.isArray(exercise.imageUrls)
    ? exercise.imageUrls.map((imageUrl, index) => ({ id: `url-${index}-${imageUrl}`, imageUrl, isPrimary: index === 0 }))
    : [];
  const images: RawExerciseImage[] = rawImages.length ? rawImages : urlImages;
  const normalized: ExerciseImage[] = images
    .map((image, index) => ({
      id: image.id || `image-${index}-${image.imageUrl || image.image_url || image.url}`,
      imageUrl: image.imageUrl || image.image_url || image.url || "",
      altText: image.altText || image.alt_text || "",
      isPrimary: Boolean(image.isPrimary || image.is_primary),
    }))
    .filter((image) => image.imageUrl);
  const primaryUrl = exercise.image_url || exercise.imageUrl || exercise.thumbnail_url || "";

  if (primaryUrl && !normalized.some((image) => image.imageUrl === primaryUrl)) {
    normalized.unshift({ id: `primary-${primaryUrl}`, imageUrl: primaryUrl, altText: "", isPrimary: true });
  }

  if (normalized.length && !normalized.some((image) => image.isPrimary)) {
    normalized[0].isPrimary = true;
  }

  return normalized.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

function normalizeExercise(exercise: RawExercise): Exercise {
  const images = normalizeExerciseImages(exercise);
  return {
    id: exercise.id || exercise.exercise_id || exercise.exerciseId || exercise.exercise_name || exercise.exerciseName || "",
    name: exercise.exercise_name || exercise.exerciseName || exercise.name || "Άσκηση",
    muscle: exercise.muscle_group || exercise.muscleGroup || exercise.primary_muscle_group || "",
    image: exercise.image_url || exercise.imageUrl || exercise.thumbnail_url || images[0]?.imageUrl || "",
    images,
    video: exercise.video_url || exercise.videoUrl || "",
    sets: exercise.sets || "-",
    reps: exercise.reps || "-",
    tempo: exercise.tempo || "-",
    rest: exercise.rest_seconds || exercise.restSeconds || exercise.rest || "",
    notes: exercise.notes || "",
  };
}

function normalizeDay(day: RawDay, index: number): Day {
  const dayOfWeek = Number(day.day_of_week ?? day.dayOfWeek ?? index + 1);
  return {
    id: day.id || `${day.day_of_week ?? day.dayOfWeek ?? index}-${index}`,
    dayOfWeek,
    title: day.title || dayNames[dayOfWeek] || `Ημέρα ${index + 1}`,
    notes: day.notes || "",
    exercises: (day.exercises || []).map(normalizeExercise),
  };
}

function formatRest(value: string | number): string {
  if (!value) return "-";
  const raw = String(value);
  if (raw.includes('"') || raw.includes("'")) return raw;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) ? `${seconds}”` : raw;
}

function difficultyLabel(value?: string): string {
  const labels: Record<string, string> = {
    beginner: "Αρχάριο",
    intermediate: "Μεσαίο",
    advanced: "Προχωρημένο",
  };
  return (value && labels[value]) || value || "Μεσαίο";
}

export default function WorkoutProgramView({
  training,
  emptyText = "Δεν έχει ανατεθεί πρόγραμμα προπόνησης ακόμα.",
}: {
  training?: TrainingProgram | null;
  emptyText?: string;
}) {
  const days = useMemo(
    () =>
      (training?.days || [])
        .map(normalizeDay)
        .filter((day) => day.exercises.length || day.title || day.notes),
    [training],
  );
  const [activeDayId, setActiveDayId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!activeDayId && days.length) setActiveDayId(days[0].id);
    if (activeDayId && days.length && !days.some((day) => day.id === activeDayId)) setActiveDayId(days[0].id);
  }, [activeDayId, days]);

  if (!training || !days.length) {
    return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">{emptyText}</div>;
  }

  const activeDay = days.find((day) => day.id === activeDayId) || days[0];
  const totalSets = activeDay.exercises.reduce((sum, exercise) => sum + (Number.parseInt(String(exercise.sets), 10) || 0), 0);
  const estimatedMinutes = Math.max(30, Math.min(90, activeDay.exercises.length * 10 + totalSets * 2));

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Πρόγραμμα Προπόνησης</h2>
          <p className="mt-2 text-xl font-bold text-slate-600">{training.title || "Πρόγραμμα Προπόνησης"}</p>
        </div>
        <div className="flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-6 font-black text-slate-700 shadow-sm">
          <Clock className="h-5 w-5 text-slate-500" />
          Περίπου {estimatedMinutes} λεπτά
        </div>
      </div>

      <Tabs value={String(activeDay.id)} onValueChange={(value) => setActiveDayId(value)} className="gap-7">
        <TabsList className="grid h-auto w-full gap-2 bg-white p-2 sm:grid-cols-2 lg:grid-cols-5">
          {days.slice(0, 7).map((day, index) => (
            <TabsTrigger
              key={day.id}
              value={String(day.id)}
              className="min-h-[72px] flex-col whitespace-normal rounded-md px-4 py-3 font-black data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-100"
            >
              <div>Ημέρα {index + 1}</div>
              <div className="mt-1 truncate text-xs font-bold text-slate-500 group-data-[state=active]:text-white/90 data-[state=active]:text-white/90">
                {[...new Set(day.exercises.map((exercise) => exercise.muscle).filter(Boolean))].join(" / ") || "Χωρίς ασκήσεις"}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {days.map((day, dayIndex) => {
          const dayMuscles = [...new Set(day.exercises.map((exercise) => exercise.muscle).filter(Boolean))];

          return (
            <TabsContent key={day.id} value={String(day.id)} className="space-y-7">
              <Card className="overflow-hidden" style={{ "--card-spacing": "0px" } as CSSProperties}>
                <div className="flex items-center gap-4 border-b border-slate-100 p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600">
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">Ημέρα {dayIndex + 1}</h3>
                    <div className="mt-1 text-sm font-bold text-slate-500">{dayMuscles.join(" / ") || "Χωρίς ασκήσεις"}</div>
                  </div>
                </div>

                <div className="mx-5 hidden grid-cols-[minmax(0,1fr)_72px_92px_92px_82px_42px] rounded-lg bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500 md:grid">
                  <div>Άσκηση</div>
                  <div className="text-center">Σετ</div>
                  <div className="text-center">Επαναλ.</div>
                  <div className="text-center">Tempo</div>
                  <div className="text-center">Rest</div>
                  <div />
                </div>

                <div className="divide-y divide-slate-100 p-5 pt-0">
                  {day.exercises.map((exercise) => (
                    <div key={exercise.id} className="grid gap-4 rounded-lg px-0 py-5 md:grid-cols-[minmax(0,1fr)_72px_92px_92px_82px_42px] md:items-center">
                      <div className="flex min-w-0 items-center gap-4">
                        <ExercisePhotoSlider exercise={exercise} />
                        <div className="min-w-0">
                          <div className="text-lg font-black text-slate-950">{exercise.name}</div>
                          <div className="mt-1 text-sm font-bold text-slate-500">{exercise.muscle || "-"}</div>
                        </div>
                      </div>
                      <StatCell label="Σετ" value={exercise.sets} />
                      <StatCell label="Επαναλ." value={exercise.reps} />
                      <StatCell label="Tempo" value={exercise.tempo} />
                      <StatCell label="Rest" value={formatRest(exercise.rest)} />
                      <Button variant="outline" size="icon" title="Video">
                        <Play className="h-4 w-4" />
                      </Button>
                      {exercise.notes && (
                        <div className="rounded-md bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 md:col-span-6">{exercise.notes}</div>
                      )}
                    </div>
                  ))}
                  {!day.exercises.length && (
                    <div className="p-8 text-center font-bold text-slate-500">Δεν υπάρχουν ασκήσεις για αυτή την ημέρα.</div>
                  )}
                </div>

                {training.description && (
                  <div className="mx-5 mb-5 rounded-lg border border-red-100 bg-red-50 p-5">
                    <div className="font-black text-slate-950">Οδηγίες</div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{training.description}</p>
                  </div>
                )}
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
        <SummaryItem icon={<Clock className="h-5 w-5" />} label="Διάρκεια Προπόνησης" value={`~ ${estimatedMinutes} λεπτά`} />
        <SummaryItem
          icon={<Flame className="h-5 w-5" />}
          label="Εκτιμώμενες Θερμίδες"
          value={`${Math.max(250, activeDay.exercises.length * 85)}-${Math.max(350, activeDay.exercises.length * 110)} kcal`}
        />
        <SummaryItem icon={<LayoutGrid className="h-5 w-5" />} label="Επίπεδο" value={difficultyLabel(training.difficulty)} />
      </div>
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 md:block md:bg-transparent md:px-0 md:py-0 md:text-center">
      <span className="text-xs font-black text-slate-500 md:hidden">{label}</span>
      <span className="text-lg font-black text-slate-950 md:text-xl">{value || "-"}</span>
    </div>
  );
}

function ExercisePhotoSlider({ exercise }: { exercise: Exercise }) {
  const images = exercise.images?.length ? exercise.images : normalizeExerciseImages({ imageUrl: exercise.image });
  const [index, setIndex] = useState(0);
  const activeImage = images[index] || images[0];

  useEffect(() => setIndex(0), [exercise.id, images.length]);

  if (!activeImage?.imageUrl) {
    return (
      <div className="h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-slate-200">
        <div className="grid h-full w-full place-items-center text-xs font-black text-slate-500">PHOTO</div>
      </div>
    );
  }

  return (
    <div className="group relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resolveMediaUrl(activeImage.imageUrl)} alt="" className="h-full w-full object-cover" />
      {images.length > 1 && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)}
            className="absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white/90 text-slate-900 opacity-0 shadow transition group-hover:opacity-100 hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setIndex((value) => (value + 1) % images.length)}
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white/90 text-slate-900 opacity-0 shadow transition group-hover:opacity-100 hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {images.map((image, imageIndex) => (
              <Button
                key={`${image.id}-${imageIndex}`}
                type="button"
                variant="ghost"
                onClick={() => setIndex(imageIndex)}
                className={`h-1.5 min-w-0 rounded-full p-0 transition-all hover:bg-white ${imageIndex === index ? "w-5 bg-red-600" : "w-1.5 bg-white/80"}`}
                aria-label={`Photo ${imageIndex + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">{icon}</div>
      <div>
        <div className="text-sm font-bold text-slate-500">{label}</div>
        <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
      </div>
    </div>
  );
}
