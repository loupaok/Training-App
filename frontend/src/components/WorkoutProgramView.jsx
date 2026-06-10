import { useEffect, useMemo, useState } from 'react';

const API_ORIGIN = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

function resolveMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${String(url).replace(/^\/+/, '')}`;
}

function normalizeExerciseImages(exercise = {}) {
  const rawImages = Array.isArray(exercise.images) ? exercise.images : [];
  const urlImages = Array.isArray(exercise.imageUrls)
    ? exercise.imageUrls.map((imageUrl, index) => ({ id: `url-${index}-${imageUrl}`, imageUrl, isPrimary: index === 0 }))
    : [];
  const images = rawImages.length ? rawImages : urlImages;
  const normalized = images
    .map((image, index) => ({
      id: image.id || `image-${index}-${image.imageUrl || image.image_url || image.url}`,
      imageUrl: image.imageUrl || image.image_url || image.url || '',
      altText: image.altText || image.alt_text || '',
      isPrimary: Boolean(image.isPrimary || image.is_primary),
    }))
    .filter((image) => image.imageUrl);
  const primaryUrl = exercise.image_url || exercise.imageUrl || exercise.thumbnail_url || '';

  if (primaryUrl && !normalized.some((image) => image.imageUrl === primaryUrl)) {
    normalized.unshift({ id: `primary-${primaryUrl}`, imageUrl: primaryUrl, altText: '', isPrimary: true });
  }

  if (normalized.length && !normalized.some((image) => image.isPrimary)) {
    normalized[0].isPrimary = true;
  }

  return normalized.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

function normalizeExercise(exercise) {
  const images = normalizeExerciseImages(exercise);
  return {
    id: exercise.id || exercise.exercise_id || exercise.exerciseId || exercise.exerciseName || exercise.exercise_name,
    name: exercise.exercise_name || exercise.exerciseName || exercise.name || 'Άσκηση',
    muscle: exercise.muscle_group || exercise.muscleGroup || exercise.primary_muscle_group || '',
    image: exercise.image_url || exercise.imageUrl || exercise.thumbnail_url || images[0]?.imageUrl || '',
    images,
    video: exercise.video_url || exercise.videoUrl || '',
    sets: exercise.sets || '-',
    reps: exercise.reps || '-',
    tempo: exercise.tempo || '-',
    rest: exercise.rest_seconds || exercise.restSeconds || exercise.rest || '',
    notes: exercise.notes || '',
  };
}

function normalizeDay(day, index) {
  return {
    id: day.id || `${day.day_of_week ?? day.dayOfWeek ?? index}-${index}`,
    dayOfWeek: Number(day.day_of_week ?? day.dayOfWeek ?? index + 1),
    title: day.title || dayNames[Number(day.day_of_week ?? day.dayOfWeek ?? index + 1)] || `Ημέρα ${index + 1}`,
    notes: day.notes || '',
    exercises: (day.exercises || []).map(normalizeExercise),
  };
}

function formatRest(value) {
  if (!value) return '-';
  const raw = String(value);
  if (raw.includes('"') || raw.includes("'")) return raw;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) ? `${seconds}”` : raw;
}

function difficultyLabel(value) {
  return {
    beginner: 'Αρχάριο',
    intermediate: 'Μεσαίο',
    advanced: 'Προχωρημένο',
  }[value] || value || 'Μεσαίο';
}

export default function WorkoutProgramView({ training, emptyText = 'Δεν έχει ανατεθεί πρόγραμμα προπόνησης ακόμα.' }) {
  const days = useMemo(() => (training?.days || [])
    .map(normalizeDay)
    .filter((day) => day.exercises.length || day.title || day.notes), [training]);
  const [activeDayId, setActiveDayId] = useState(null);

  useEffect(() => {
    if (!activeDayId && days.length) setActiveDayId(days[0].id);
    if (activeDayId && days.length && !days.some((day) => day.id === activeDayId)) setActiveDayId(days[0].id);
  }, [activeDayId, days]);

  if (!training || !days.length) {
    return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">{emptyText}</div>;
  }

  const activeDay = days.find((day) => day.id === activeDayId) || days[0];
  const totalSets = activeDay.exercises.reduce((sum, exercise) => sum + (Number.parseInt(exercise.sets, 10) || 0), 0);
  const estimatedMinutes = Math.max(30, Math.min(90, activeDay.exercises.length * 10 + totalSets * 2));
  const estimatedCalories = `${Math.max(250, activeDay.exercises.length * 85)}-${Math.max(350, activeDay.exercises.length * 110)} kcal`;
  const activeMuscles = [...new Set(activeDay.exercises.map((exercise) => exercise.muscle).filter(Boolean))];

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Πρόγραμμα Προπόνησης</h2>
          <p className="mt-2 text-xl font-bold text-slate-600">{training.title || 'Πρόγραμμα Προπόνησης'}</p>
        </div>
        <div className="flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-6 font-black text-slate-700 shadow-sm">
          <span className="text-xl text-slate-500">◷</span>
          Περίπου {estimatedMinutes} λεπτά
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        {days.slice(0, 7).map((day, index) => (
          <button
            key={day.id}
            type="button"
            onClick={() => setActiveDayId(day.id)}
            className={`min-h-[72px] rounded-md px-4 py-3 text-center font-black transition ${
              activeDay.id === day.id ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'border border-slate-100 text-slate-950 hover:bg-slate-50'
            }`}
          >
            <div>Ημέρα {index + 1}</div>
            <div className={`mt-1 truncate text-xs font-bold ${activeDay.id === day.id ? 'text-white/90' : 'text-slate-500'}`}>
              {[...new Set(day.exercises.map((exercise) => exercise.muscle).filter(Boolean))].join(' / ') || 'Χωρίς ασκήσεις'}
            </div>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 border-b border-slate-100 p-6">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-xl text-red-600">✱</div>
          <div>
            <h3 className="text-2xl font-black">Ημέρα {days.findIndex((day) => day.id === activeDay.id) + 1}</h3>
            <div className="mt-1 text-sm font-bold text-slate-500">{activeMuscles.join(' / ') || 'Χωρίς ασκήσεις'}</div>
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
          {activeDay.exercises.map((exercise) => (
            <div key={exercise.id} className="grid gap-4 rounded-lg px-0 py-5 md:grid-cols-[minmax(0,1fr)_72px_92px_92px_82px_42px] md:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <ExercisePhotoSlider exercise={exercise} />
                <div className="min-w-0">
                  <div className="text-lg font-black text-slate-950">{exercise.name}</div>
                  <div className="mt-1 text-sm font-bold text-slate-500">{exercise.muscle || '-'}</div>
                </div>
              </div>
              <StatCell label="Σετ" value={exercise.sets} />
              <StatCell label="Επαναλ." value={exercise.reps} />
              <StatCell label="Tempo" value={exercise.tempo} />
              <StatCell label="Rest" value={formatRest(exercise.rest)} />
              <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-700 hover:border-red-200 hover:text-red-600" title="Video">
                ▷
              </button>
              {exercise.notes && <div className="md:col-span-6 rounded-md bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{exercise.notes}</div>}
            </div>
          ))}
          {!activeDay.exercises.length && <div className="p-8 text-center font-bold text-slate-500">Δεν υπάρχουν ασκήσεις για αυτή την ημέρα.</div>}
        </div>

        {training.description && (
          <div className="mx-5 mb-5 rounded-lg border border-red-100 bg-red-50 p-5">
            <div className="font-black text-slate-950">Οδηγίες</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{training.description}</p>
          </div>
        )}
      </section>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
        <SummaryItem icon="◷" label="Διάρκεια Προπόνησης" value={`~ ${estimatedMinutes} λεπτά`} />
        <SummaryItem icon="🔥" label="Εκτιμώμενες Θερμίδες" value={estimatedCalories} />
        <SummaryItem icon="▥" label="Επίπεδο" value={difficultyLabel(training.difficulty)} />
      </div>
    </section>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 md:block md:bg-transparent md:px-0 md:py-0 md:text-center">
      <span className="text-xs font-black text-slate-500 md:hidden">{label}</span>
      <span className="text-lg font-black text-slate-950 md:text-xl">{value || '-'}</span>
    </div>
  );
}

function ExercisePhotoSlider({ exercise }) {
  const images = exercise.images?.length
    ? exercise.images
    : normalizeExerciseImages({ imageUrl: exercise.image });
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
      <img src={resolveMediaUrl(activeImage.imageUrl)} alt="" className="h-full w-full object-cover" />
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)} className="absolute left-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg font-black text-slate-900 opacity-0 shadow transition group-hover:opacity-100">
            ‹
          </button>
          <button type="button" onClick={() => setIndex((value) => (value + 1) % images.length)} className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg font-black text-slate-900 opacity-0 shadow transition group-hover:opacity-100">
            ›
          </button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {images.map((image, imageIndex) => (
              <button
                key={`${image.id}-${imageIndex}`}
                type="button"
                onClick={() => setIndex(imageIndex)}
                className={`h-1.5 rounded-full transition-all ${imageIndex === index ? 'w-5 bg-red-600' : 'w-1.5 bg-white/80'}`}
                aria-label={`Photo ${imageIndex + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryItem({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-xl text-red-600">{icon}</div>
      <div>
        <div className="text-sm font-bold text-slate-500">{label}</div>
        <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
      </div>
    </div>
  );
}
