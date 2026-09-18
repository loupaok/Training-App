"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media";

export interface RawExerciseImage {
  id?: string | number;
  imageUrl?: string;
  image_url?: string;
  url?: string;
  altText?: string;
  alt_text?: string;
  isPrimary?: boolean;
  is_primary?: boolean;
}

export interface NormalizedExerciseImage {
  id: string | number;
  imageUrl: string;
  altText: string;
  isPrimary: boolean;
}

export interface Exercise {
  id: string | number;
  name: string;
  muscleGroup: string;
  equipment: string;
  type: string;
  programsCount?: number;
  instructions?: string;
  imageUrl?: string;
  videoUrl?: string;
  images?: RawExerciseImage[];
  imageUrls?: string[];
}

export function normalizeExerciseImages(exercise: Partial<Exercise> = {}): NormalizedExerciseImage[] {
  const rawImages: RawExerciseImage[] = Array.isArray(exercise.images) ? exercise.images : [];
  const fromUrls: RawExerciseImage[] = Array.isArray(exercise.imageUrls)
    ? exercise.imageUrls.map((imageUrl, index) => ({ id: `local-${index}-${imageUrl}`, imageUrl, isPrimary: index === 0 }))
    : [];
  const images = rawImages.length ? rawImages : fromUrls;
  const hasPrimary = images.some((image) => image.imageUrl === exercise.imageUrl || image.isPrimary);
  const normalized: NormalizedExerciseImage[] = images
    .map((image, index) => ({
      id: image.id || `local-${index}-${image.imageUrl}`,
      imageUrl: image.imageUrl || image.image_url || image.url || "",
      altText: image.altText || image.alt_text || "",
      isPrimary: Boolean(image.isPrimary || image.is_primary || image.imageUrl === exercise.imageUrl),
    }))
    .filter((image) => image.imageUrl);

  if (exercise.imageUrl && !normalized.some((image) => image.imageUrl === exercise.imageUrl)) {
    normalized.unshift({ id: `local-primary-${exercise.imageUrl}`, imageUrl: exercise.imageUrl, altText: "", isPrimary: true });
  }

  if (!hasPrimary && normalized[0]) {
    normalized[0].isPrimary = true;
  }

  return normalized;
}

export function ExerciseImage({ exercise, large = false }: { exercise: Partial<Exercise>; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = large ? "h-full w-full" : "h-14 w-20 rounded-md";
  const firstImage = normalizeExerciseImages(exercise)[0];
  const src = resolveMediaUrl(firstImage?.imageUrl || exercise.imageUrl);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className={`${sizeClass} grid place-items-center bg-slate-900 p-2 text-center text-[10px] font-bold leading-tight text-white`}>
        <ImageIcon className={large ? "mb-3 h-10 w-10" : "hidden"} />
        {exercise.name}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={exercise.name || ""} className={`${sizeClass} bg-slate-200 object-cover dark:bg-slate-800`} onError={() => setFailed(true)} />
  );
}

export function ExerciseImageSlider({ exercise, large = false }: { exercise: Partial<Exercise>; large?: boolean }) {
  const images = normalizeExerciseImages(exercise);
  const [index, setIndex] = useState(0);
  const activeImage = images[index] || images[0];

  useEffect(() => setIndex(0), [exercise?.id, images.length]);

  if (!activeImage) {
    return <ExerciseImage exercise={exercise} large={large} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resolveMediaUrl(activeImage.imageUrl)} alt={exercise.name || ""} className="h-full w-full object-cover" />
      {images.length > 1 && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={(event) => {
              setIndex((value) => (value - 1 + images.length) % images.length);
              event.currentTarget.blur();
            }}
            className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-slate-900 shadow hover:bg-white/90"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={(event) => {
              setIndex((value) => (value + 1) % images.length);
              event.currentTarget.blur();
            }}
            className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-slate-900 shadow hover:bg-white/90"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((image, imageIndex) => (
              <Button
                key={`${image.id}-${imageIndex}`}
                type="button"
                variant="ghost"
                onClick={() => setIndex(imageIndex)}
                className={`h-2 min-w-0 rounded-full p-0 transition-all hover:bg-white ${imageIndex === index ? "w-7 bg-red-600" : "w-2 bg-white/80"}`}
                aria-label={`Φωτογραφία ${imageIndex + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
