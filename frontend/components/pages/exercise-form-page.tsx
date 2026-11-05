"use client";

import { startTransition, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronDown, Play, Trash2, Plus, Search, Images, Upload } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MediaLibraryPickerDialog } from "@/components/shared/media-library-picker-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { compressImageFile } from "@/lib/image-compression";
import { cn } from "@/lib/utils";
import {
  ExerciseImageSlider,
  normalizeExerciseImages,
  type Exercise,
  type RawExerciseImage,
  type NormalizedExerciseImage,
} from "@/components/shared/exercise-visuals";

const UNSET_VALUE = "__unset__";
const MEDIA_PAGE_SIZE = 48;

interface EditForm {
  name: string;
  muscleGroup: string;
  equipment: string;
  level: string;
  type: string;
  instructions: string;
  commonMistakes: string;
  programsCount: number | string;
  imageUrl: string;
  videoUrl: string;
}

interface FiltersState {
  muscleGroups: string[];
  equipment: string[];
  types: string[];
}

interface FilterOption {
  value: string;
}

interface FiltersResponse {
  muscleGroups: FilterOption[];
  equipment: FilterOption[];
  types?: FilterOption[];
}

interface MediaAsset {
  id: string | number;
  kind?: string;
  assetType?: string;
  title: string;
  url: string;
  folderName?: string;
  source?: string;
}

function withDefaults(values: string[], defaults: string[]): string[] {
  return [...new Set([...(values || []), ...defaults].filter(Boolean))].sort((a, b) => a.localeCompare(b, "el"));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function draftExercise(): Exercise {
  return {
    id: "new",
    name: "",
    muscleGroup: "",
    equipment: "",
    type: "Δύναμη",
    programsCount: 0,
    instructions: "",
    commonMistakes: "",
    imageUrl: "",
    videoUrl: "",
  };
}

function editFormFrom(exercise: Exercise): EditForm {
  return {
    name: exercise.name || "",
    muscleGroup: exercise.muscleGroup || "",
    equipment: exercise.equipment || "",
    level: (exercise as Exercise & { level?: string }).level || "Μέσος",
    type: exercise.type || "Δύναμη",
    instructions: exercise.instructions || "",
    commonMistakes: exercise.commonMistakes || "",
    programsCount: exercise.programsCount || 0,
    imageUrl: exercise.imageUrl || "",
    videoUrl: exercise.videoUrl || "",
  };
}

function ExerciseFormContent({ exerciseId, forceEdit = false }: { exerciseId: string | null; forceEdit?: boolean }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCreatingRoute = exerciseId === null;

  const [filters, setFilters] = useState<FiltersState>({ muscleGroups: [], equipment: [], types: [] });
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">(isCreatingRoute || forceEdit ? "edit" : "view");
  const [isCreating, setIsCreating] = useState(isCreatingRoute);
  const [loading, setLoading] = useState(!isCreatingRoute);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [visibleMediaCount, setVisibleMediaCount] = useState(MEDIA_PAGE_SIZE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    api
      .get<FiltersResponse>("/exercises/filters")
      .then((data) =>
        setFilters({
          muscleGroups: data.muscleGroups.map((item) => item.value),
          equipment: data.equipment.map((item) => item.value),
          types: data.types?.map((item) => item.value) || [],
        }),
      )
      .catch(() => setFilters({ muscleGroups: [], equipment: [], types: [] }));
  }, []);

  useEffect(() => {
    if (isCreatingRoute) {
      const draft = draftExercise();
      setExercise(draft);
      setEditForm(editFormFrom(draft));
      setIsCreating(true);
      setModalMode("edit");
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    setLoadError("");
    api
      .get<Exercise>(`/exercises/${exerciseId}`)
      .then((data) => {
        if (ignore) return;
        setExercise(data);
        setEditForm(editFormFrom(data));
        setIsCreating(false);
        setModalMode(forceEdit || searchParams.get("mode") === "edit" ? "edit" : "view");
      })
      .catch((error) => {
        if (!ignore) setLoadError(getErrorMessage(error, "Δεν φορτώθηκε η άσκηση."));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, isCreatingRoute]);

  const muscleGroupOptions = useMemo(
    () =>
      withDefaults(filters.muscleGroups, [
        "Στήθος",
        "Πλάτη",
        "Ώμοι",
        "Δικέφαλοι",
        "Τρικέφαλοι",
        "Τετρακέφαλοι",
        "Οπίσθιοι Μηριαίοι",
        "Γλουτοί",
        "Γάμπες",
        "Κοιλιακοί",
        "Core",
        "Full Body",
        "Γενική",
      ]),
    [filters.muscleGroups],
  );
  const equipmentOptions = useMemo(
    () =>
      withDefaults(filters.equipment, [
        "Χωρίς εξοπλισμό",
        "Σωματικό βάρος",
        "Μπάρα",
        "Αλτήρες",
        "Μηχάνημα",
        "Τροχαλία",
        "Πάγκος",
        "Kettlebell",
        "Λάστιχα",
        "TRX",
      ]),
    [filters.equipment],
  );
  const typeOptions = useMemo(
    () => withDefaults(filters.types, ["Δύναμη", "Υπερτροφία", "Αντοχή", "Κινητικότητα", "Cardio", "Core", "Αποκατάσταση"]),
    [filters.types],
  );

  const updateExercise = (patch: Partial<Exercise>) => {
    setExercise((current) => (current ? { ...current, ...patch } : current));
  };

  const updateExerciseImages = (images: RawExerciseImage[], preferredImageUrl = "") => {
    const normalizedImages = normalizeExerciseImages({ images, imageUrl: preferredImageUrl });
    const primaryImage = normalizedImages.find((image) => image.isPrimary) || normalizedImages[0];
    const nextImageUrl = preferredImageUrl || primaryImage?.imageUrl || "";
    setEditForm((current) => (current ? { ...current, imageUrl: nextImageUrl } : current));
    updateExercise({
      imageUrl: nextImageUrl,
      images: normalizedImages,
      imageUrls: normalizedImages.map((image) => image.imageUrl),
    });
  };

  const updateEditField = <K extends keyof EditForm>(field: K, value: EditForm[K]) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const saveExercise = async (draft?: Pick<EditForm, "instructions" | "commonMistakes">) => {
    if (!exercise || !editForm) return;
    setSaving(true);
    setMediaMessage("");

    try {
      const formForSave = { ...editForm, ...draft };
      const payload = {
        ...formForSave,
        name: formForSave.name?.trim() || "Νέα Άσκηση",
        muscleGroup: formForSave.muscleGroup?.trim() || "Γενική",
        equipment: formForSave.equipment?.trim() || "Χωρίς εξοπλισμό",
        type: formForSave.type?.trim() || "Δύναμη",
        programsCount: Number(formForSave.programsCount || 0),
      };

      const updated = isCreating
        ? await api.post<Exercise>("/exercises", payload)
        : await api.put<Exercise>(`/exercises/${exercise.id}`, payload);

      setExercise(updated);
      setEditForm(editFormFrom(updated));
      setMediaMessage(isCreating ? "Η άσκηση προστέθηκε στη βάση." : "Η άσκηση ενημερώθηκε στη βάση.");

      if (isCreating) {
        setIsCreating(false);
        router.replace("/exercises");
      }
    } catch (error) {
      setMediaMessage(getErrorMessage(error, "Δεν αποθηκεύτηκαν οι αλλαγές της άσκησης."));
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = async () => {
    if (!exercise || isCreating) return;

    setSaving(true);
    setMediaMessage("");
    try {
      await api.delete(`/exercises/${exercise.id}`);
      router.push("/exercises");
    } catch (error) {
      setMediaMessage(getErrorMessage(error, "Δεν έγινε διαγραφή της άσκησης."));
      setSaving(false);
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !exercise || isCreating) return;

    setSaving(true);
    setMediaMessage("Συμπίεση φωτογραφίας...");

    const compressedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append("image", compressedFile);

    try {
      const response = await api.upload<{ imageId?: string; imageUrl: string }>(`/exercises/${exercise.id}/image`, formData);
      const nextImages: RawExerciseImage[] = [
        { id: response.imageId || `new-${Date.now()}`, imageUrl: response.imageUrl, isPrimary: true },
        ...normalizeExerciseImages(exercise)
          .filter((image) => image.imageUrl !== response.imageUrl)
          .map((image) => ({ ...image, isPrimary: false })),
      ];
      updateExerciseImages(nextImages, response.imageUrl);
      setMediaMessage(`Η φωτογραφία συμπιέστηκε και προστέθηκε στο gallery. ${formatBytes(file.size)} → ${formatBytes(compressedFile.size)}`);
    } catch (error) {
      setMediaMessage(getErrorMessage(error, "Το upload απέτυχε."));
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (!mediaPickerOpen) return;
    let ignore = false;
    const query = mediaSearch.trim();
    const timer = window.setTimeout(async () => {
      setVisibleMediaCount(MEDIA_PAGE_SIZE);
      try {
        const assets = await api.get<MediaAsset[]>(query ? `/media?search=${encodeURIComponent(query)}` : "/media");
        if (ignore) return;
        const photos = assets.filter((asset) => asset.assetType === "photo");
        // Keep rendering a large result set from blocking input.
        startTransition(() => setMediaAssets(photos));
      } catch {
        if (!ignore) setMediaAssets([]);
      }
    }, query ? 300 : 0);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [mediaPickerOpen, mediaSearch]);

  const openMediaPicker = () => {
    setMediaSearch("");
    setMediaAssets([]);
    setVisibleMediaCount(MEDIA_PAGE_SIZE);
    setMediaPickerOpen(true);
  };

  const chooseMediaAsset = async (asset: MediaAsset) => {
    setMediaPickerOpen(false);

    if (isCreating || !exercise) {
      updateEditField("imageUrl", asset.url);
      setMediaMessage(`Επιλέχθηκε εικόνα από Media Library: ${asset.title}`);
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<{ images?: RawExerciseImage[] }>(`/exercises/${exercise.id}/images`, {
        imageUrl: asset.url,
        primary: true,
      });
      updateExerciseImages(response.images || [], asset.url);
      setMediaMessage(`Προστέθηκε στο gallery από Media Library: ${asset.title}`);
    } catch (error) {
      updateEditField("imageUrl", asset.url);
      setMediaMessage(getErrorMessage(error, "Δεν προστέθηκε η εικόνα στο gallery."));
    } finally {
      setSaving(false);
    }
  };

  const chooseMediaAssetUrl = async (url: string) => {
    setMediaPickerOpen(false);

    if (isCreating || !exercise) {
      updateEditField("imageUrl", url);
      setMediaMessage("Επιλέχθηκε εικόνα από Media Library.");
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<{ images?: RawExerciseImage[] }>(`/exercises/${exercise.id}/images`, {
        imageUrl: url,
        primary: true,
      });
      updateExerciseImages(response.images || [], url);
      setMediaMessage("Προστέθηκε στο gallery από Media Library.");
    } catch (error) {
      updateEditField("imageUrl", url);
      setMediaMessage(getErrorMessage(error, "Δεν προστέθηκε η εικόνα στο gallery."));
    } finally {
      setSaving(false);
    }
  };

  const clearThumbnail = () => {
    updateEditField("imageUrl", "");
    setMediaMessage("Το thumbnail αφαιρέθηκε. Πάτησε αποθήκευση για να ενημερωθεί η άσκηση.");
  };

  const deleteExerciseImage = async (image: NormalizedExerciseImage) => {
    if (!image?.id || !exercise || isCreating || String(image.id).startsWith("local")) return;
    const confirmed = window.confirm("Να διαγραφεί αυτή η φωτογραφία από την άσκηση;");
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await api.delete<{ images?: RawExerciseImage[] }>(`/exercises/${exercise.id}/images/${image.id}`);
      updateExerciseImages(response.images || []);
      setMediaMessage("Η φωτογραφία διαγράφηκε από την άσκηση.");
    } catch (error) {
      setMediaMessage(getErrorMessage(error, "Δεν διαγράφηκε η φωτογραφία."));
    } finally {
      setSaving(false);
    }
  };

  const reorderImages = async (fromId: string, toId: string) => {
    if (!exercise || fromId === toId) return;
    const ids = currentImages.map((image) => String(image.id));
    const oldIndex = ids.indexOf(fromId);
    const newIndex = ids.indexOf(toId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentImages, oldIndex, newIndex);
    const nextImageUrl = reordered[0]?.imageUrl || "";
    setEditForm((current) => (current ? { ...current, imageUrl: nextImageUrl } : current));
    updateExercise({
      images: reordered.map((image, index) => ({ id: image.id, imageUrl: image.imageUrl, altText: image.altText, isPrimary: index === 0 })),
      imageUrls: reordered.map((image) => image.imageUrl),
      imageUrl: nextImageUrl,
    });

    try {
      const response = await api.put<{ images?: RawExerciseImage[] }>(`/exercises/${exercise.id}/images/reorder`, {
        order: reordered.map((image) => image.id),
      });
      updateExerciseImages(response.images || []);
    } catch (error) {
      setMediaMessage(getErrorMessage(error, "Δεν αποθηκεύτηκε η σειρά των φωτογραφιών."));
    }
  };

  const handleImageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    reorderImages(String(active.id), String(over.id));
  };

  const filteredMediaAssets = mediaAssets;

  const isReadOnly = modalMode === "view";
  const currentImages = exercise && editForm ? normalizeExerciseImages({ ...exercise, imageUrl: editForm.imageUrl }) : [];

  if (forceEdit && !loading && exercise && editForm) {
    return <CoachShell title={isCreating ? "Νέα άσκηση" : "Επεξεργασία άσκησης"} user={user} logout={logout}>
      <AdminExerciseEditor
        creating={isCreating}
        form={editForm}
        images={currentImages}
        saving={saving}
        message={mediaMessage}
        onChange={updateEditField}
        onSave={(draft) => saveExercise(draft)}
        onDelete={() => setDeleteDialogOpen(true)}
        onCancel={() => router.push("/exercises")}
        onPickMedia={openMediaPicker}
        onUploadClick={() => fileInputRef.current?.click()}
      />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadImage} className="hidden" />
      <MediaLibraryPickerDialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen} onSelect={chooseMediaAssetUrl} title="Επιλογή από Media Library" />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Διαγραφή άσκησης;</AlertDialogTitle><AlertDialogDescription>Η «{exercise.name}» θα διαγραφεί οριστικά από τη Βιβλιοθήκη Ασκήσεων.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Ακύρωση</AlertDialogCancel><AlertDialogAction onClick={deleteExercise} disabled={saving} className="bg-red-600 text-white hover:bg-red-700">{saving ? "Διαγραφή…" : "Ναι, διαγραφή"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </CoachShell>;
  }

  return (
    <CoachShell title={isCreating ? "Νέα Άσκηση" : editForm?.name || "Άσκηση"} user={user} logout={logout}>
      <div className="mb-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 gap-1 px-2"
          nativeButton={false}
          render={<Link href="/exercises" />}
        >
          <ChevronLeft className="h-4 w-4" />
          Βιβλιοθήκη Ασκήσεων
        </Button>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-.5px]">{isCreating ? "Νέα άσκηση" : "Επεξεργασία άσκησης"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isCreating ? "Συμπλήρωσε τα βασικά, πρόσθεσε media και οδηγίες εκτέλεσης." : `Σε ${exercise?.programsCount || 0} προγράμματα · οι αλλαγές αποθηκεύονται στην άσκηση.`}</p>
          </div>
          {!loading && <div className="flex items-center gap-2">
            {!isCreating && <Button type="button" variant="outline" onClick={() => router.push("/exercises")} className="h-[46px] rounded-full px-5 font-extrabold">Ακύρωση</Button>}
            <Button type="button" onClick={() => saveExercise()} disabled={saving} className="h-[46px] rounded-full bg-accent px-6 font-extrabold text-accent-foreground hover:bg-accent/85">{saving ? "Αποθήκευση…" : "Αποθήκευση"}</Button>
          </div>}
        </div>
      </div>

      {loadError && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>
      ) : exercise && editForm ? (
        <div className="mx-auto max-w-[1180px] pb-24">
          {/* TOP — two columns */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[35%_1fr]">
            {/* LEFT — image + gallery */}
            <div>
              <div className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                <ExerciseImageSlider exercise={{ ...exercise, name: editForm.name, imageUrl: editForm.imageUrl }} large />
                {!isReadOnly && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-medium text-slate-900 shadow-sm cursor-pointer hover:bg-white"
                          >
                            🔄 Αλλαγή
                          </button>
                        }
                      />
                      <DropdownMenuContent align="center">
                        <DropdownMenuItem onClick={openMediaPicker}>📁 Από Media Library</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={isCreating}>
                          💻 Από τον υπολογιστή
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      type="button"
                      onClick={clearThumbnail}
                      disabled={!editForm.imageUrl || saving}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-medium text-red-600 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      🗑️ Διαγραφή
                    </button>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={uploadImage}
                disabled={isCreating || saving}
                className="hidden"
              />

              {isReadOnly ? (
                currentImages.length > 0 && (
                  <ScrollArea className="mt-4 w-full whitespace-nowrap">
                    <div className="flex gap-3 pb-2">
                      {currentImages.map((image, index) => (
                        <div
                          key={`${image.id}-${image.imageUrl}`}
                          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resolveMediaUrl(image.imageUrl)} alt="" className="h-full w-full object-cover" />
                          {(image.isPrimary || index === 0) && (
                            <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium text-accent-foreground">1</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )
              ) : (
                <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleImageDragEnd}>
                  <ScrollArea className="mt-4 w-full whitespace-nowrap">
                    <div className="flex gap-3 pb-2">
                      <SortableContext items={currentImages.map((image) => String(image.id))} strategy={horizontalListSortingStrategy}>
                        {currentImages.map((image, index) => (
                          <SortableThumb
                            key={image.id}
                            image={image}
                            isPrimary={image.isPrimary || image.imageUrl === editForm.imageUrl || index === 0}
                            dragDisabled={currentImages.length < 2 || String(image.id).startsWith("local")}
                            deleteDisabled={saving || !image.id || String(image.id).startsWith("local")}
                            onDelete={() => deleteExerciseImage(image)}
                          />
                        ))}
                      </SortableContext>
                      <AddImageTile onPickLibrary={openMediaPicker} onPickUpload={() => fileInputRef.current?.click()} />
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </DndContext>
              )}

              {!isReadOnly && currentImages.length > 1 && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Σύρε για αλλαγή σειράς — η πρώτη είναι η κύρια εικόνα.</p>
              )}

              {mediaMessage && <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{mediaMessage}</div>}
            </div>

            {/* RIGHT — identity + description */}
            <div>
              {editForm.muscleGroup && (
                <Badge className="mb-3 bg-red-50 font-normal text-red-700 hover:bg-red-50 dark:bg-red-500/10 dark:text-red-400">
                  {editForm.muscleGroup}
                </Badge>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                {isReadOnly ? (
                  <h1 className="text-2xl font-bold dark:text-slate-50">{editForm.name || "Χωρίς όνομα"}</h1>
                ) : (
                  <Input
                    value={editForm.name}
                    onChange={(event) => updateEditField("name", event.target.value)}
                    placeholder="Όνομα άσκησης"
                    className="h-auto flex-1 border-none bg-transparent p-0 text-2xl font-bold shadow-none focus-visible:ring-0 dark:text-slate-50"
                  />
                )}
                {isReadOnly && !isCreating && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setModalMode("edit")} className="shrink-0 gap-1.5 font-normal">
                    ✏️ Επεξεργασία
                  </Button>
                )}
              </div>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {[editForm.equipment, editForm.type].filter(Boolean).join(" · ") || "—"}
              </p>

              <Separator className="my-5" />

              {isReadOnly ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {editForm.instructions || "Δεν έχει προστεθεί περιγραφή."}
                </p>
              ) : (
                <Textarea
                  value={editForm.instructions}
                  onChange={(event) => updateEditField("instructions", event.target.value)}
                  placeholder="Περιγραφή / οδηγίες εκτέλεσης..."
                  className="min-h-28 w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                />
              )}
            </div>
          </div>

          {/* MIDDLE — stats row */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {isReadOnly ? (
              <>
                <StatBox label="Μυϊκή ομάδα" value={editForm.muscleGroup || "—"} />
                <StatBox label="Εξοπλισμός" value={editForm.equipment || "—"} />
                <StatBox label="Τύπος" value={editForm.type || "—"} />
                <StatBox label="Σε προγράμματα" value={editForm.programsCount || 0} />
              </>
            ) : (
              <>
                <EditSelect label="Μυϊκή ομάδα" value={editForm.muscleGroup} onChange={(value) => updateEditField("muscleGroup", value)} options={muscleGroupOptions} />
                <EditSelect label="Εξοπλισμός" value={editForm.equipment} onChange={(value) => updateEditField("equipment", value)} options={equipmentOptions} />
                <EditSelect label="Τύπος" value={editForm.type} onChange={(value) => updateEditField("type", value)} options={typeOptions} />
                <EditInput label="Σε προγράμματα" type="number" value={editForm.programsCount} onChange={(value) => updateEditField("programsCount", value)} />
              </>
            )}
          </div>

          {/* VIDEO */}
          {(isReadOnly ? Boolean(editForm.videoUrl) : true) && (
            <Collapsible className="mt-8">
              <CollapsibleTrigger
                render={
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 py-2 text-sm font-medium text-slate-700 hover:text-red-600 dark:text-slate-200"
                  >
                    <span>🎥 Βίντεο οδηγιών</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform data-panel-open:rotate-180" />
                  </button>
                }
              />
              <CollapsibleContent className="space-y-3 pt-2">
                {!isReadOnly && (
                  <Input
                    value={editForm.videoUrl}
                    onChange={(event) => updateEditField("videoUrl", event.target.value)}
                    placeholder="YouTube, Vimeo ή embed URL"
                    className="h-10"
                  />
                )}
                <VideoEmbed url={editForm.videoUrl} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {!isReadOnly && (
            <div className="sticky bottom-0 mt-8 border-t border-slate-200 bg-white/95 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
              <div className="flex items-center justify-between gap-3">
                {!isCreating ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={deleteExercise}
                    disabled={saving}
                    className="gap-2 font-normal text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                  >
                    🗑️ Διαγραφή
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push("/exercises")} className="font-normal">
                    Ακύρωση
                  </Button>
                  <Button onClick={() => saveExercise()} disabled={saving} className="gap-2 px-6 font-medium">
                    💾 {saving ? "Αποθήκευση..." : isCreating ? "Προσθήκη Άσκησης" : "Αποθήκευση"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
        <DialogContent className="h-[100dvh] w-[100vw] max-w-none overflow-hidden rounded-none border-0 p-5 shadow-none sm:max-w-none sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-2xl">Επιλογή από Media Library</DialogTitle>
            <DialogDescription>Διάλεξε φωτογραφία που είναι ήδη αποθηκευμένη στη βάση.</DialogDescription>
          </DialogHeader>
          <div>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                value={mediaSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  setMediaSearch(value);
                  setVisibleMediaCount(MEDIA_PAGE_SIZE);
                }}
                placeholder="Αναζήτηση φωτογραφίας..."
                aria-label="Αναζήτηση φωτογραφίας"
                className="h-12 pl-9 focus-visible:border-red-300"
              />
            </div>
            <div className="mt-5 grid max-h-[58vh] grid-cols-2 gap-4 overflow-y-auto pr-2 sm:grid-cols-4">
              {filteredMediaAssets.slice(0, visibleMediaCount).map((asset) => (
                <Button
                  key={`${asset.kind}-${asset.id}`}
                  variant="outline"
                  onClick={() => chooseMediaAsset(asset)}
                  className="h-auto flex-col items-stretch overflow-hidden whitespace-normal p-0 text-left hover:border-red-300"
                >
                  <div className="h-36 bg-slate-100 dark:bg-slate-800">
                    <PickerImage asset={asset} />
                  </div>
                  <div className="p-3">
                    <div className="truncate font-bold">{asset.title}</div>
                    <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{asset.folderName || asset.source}</div>
                  </div>
                </Button>
              ))}
            </div>
            {visibleMediaCount < filteredMediaAssets.length && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setVisibleMediaCount((count) => count + MEDIA_PAGE_SIZE)}
                className="mt-4 w-full font-medium text-slate-500 hover:text-red-600 dark:text-slate-400"
              >
                Φόρτωση περισσότερων ({filteredMediaAssets.length - visibleMediaCount} ακόμα)
              </Button>
            )}
            {!filteredMediaAssets.length && (
              <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-center font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Δεν βρέθηκαν φωτογραφίες στη Media Library.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

function AdminExerciseEditor({ creating, form, images, saving, message, onChange, onSave, onDelete, onCancel, onPickMedia, onUploadClick }: {
  creating: boolean; form: EditForm; images: NormalizedExerciseImage[]; saving: boolean; message: string;
  onChange: <K extends keyof EditForm>(field: K, value: EditForm[K]) => void;
  onSave: (draft: Pick<EditForm, "instructions" | "commonMistakes">) => void; onDelete: () => void; onCancel: () => void; onPickMedia: () => void; onUploadClick: () => void;
}) {
  const [mistakes, setMistakesState] = useState<string[]>(() => form.commonMistakes ? form.commonMistakes.split("\n") : []);
  const muscles = ["Στήθος", "Πλάτη", "Ώμοι", "Δικέφαλα", "Τρικέφαλα", "Κοιλιακοί", "Τετρακέφαλοι", "Οπίσθιοι μηριαίοι", "Γλουτοί", "Γάμπες"];
  const types = ["Δύναμη", "Cardio", "Διάταση", "Κινητικότητα"];
  const levels = ["Αρχάριος", "Μέσος", "Προχωρημένος"];
  const [steps, setStepsState] = useState<string[]>(() => form.instructions ? form.instructions.split("\n") : []);
  const stepsRef = useRef(steps);
  const mistakesRef = useRef(mistakes);
  useEffect(() => { const next = form.instructions ? form.instructions.split("\n") : []; stepsRef.current = next; setStepsState(next); }, [form.instructions]);
  useEffect(() => { const next = form.commonMistakes ? form.commonMistakes.split("\n") : []; mistakesRef.current = next; setMistakesState(next); }, [form.commonMistakes]);
  const setSteps = (next: string[]) => { stepsRef.current = next; setStepsState(next); onChange("instructions", next.join("\n")); };
  const setMistakes = (next: string[]) => { mistakesRef.current = next; setMistakesState(next); onChange("commonMistakes", next.join("\n")); };
  const ready = [Boolean(form.name && form.muscleGroup), Boolean(form.equipment), Boolean(form.videoUrl || images.length), Boolean(form.instructions?.trim())];
  const completed = ready.filter(Boolean).length;
  return <section className="mx-auto w-full max-w-[1180px] pb-24">
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4"><div><button type="button" onClick={onCancel} className="mb-3 flex items-center gap-1 text-[13px] font-extrabold"><ChevronLeft className="size-4" />Βιβλιοθήκη Ασκήσεων</button><h1 className="text-[28px] font-extrabold tracking-[-.5px]">{creating ? "Νέα άσκηση" : "Επεξεργασία άσκησης"}</h1><p className="mt-1 text-sm text-muted-foreground">{creating ? "Συμπλήρωσε τα βασικά, πρόσθεσε βίντεο ή φωτογραφίες και οδηγίες." : "Οι αλλαγές ενημερώνουν άμεσα τη Βιβλιοθήκη Ασκήσεων."}</p></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel} className="h-[46px] rounded-full px-5 font-extrabold">Ακύρωση</Button><Button type="button" onClick={() => onSave({ instructions: stepsRef.current.join("\n"), commonMistakes: mistakesRef.current.join("\n") })} disabled={saving} className="h-[46px] rounded-full bg-accent px-6 font-extrabold text-accent-foreground hover:bg-accent/85">{saving ? "Αποθήκευση…" : "Αποθήκευση"}</Button></div></div>
    {message && <div role="status" className="mb-5 rounded-[14px] border border-border bg-muted px-4 py-3 text-sm font-bold">{message}</div>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5">
      <FormCard index="1" title="Βασικά" description="Όνομα, μυϊκή ομάδα και εξοπλισμός"><div className="grid gap-[14px] sm:grid-cols-2"><Field label="Όνομα άσκησης" required><Input value={form.name} onChange={(e) => onChange("name", e.target.value)} className="h-[46px] rounded-xl font-semibold" /></Field><Field label="Εναλλακτικό όνομα"><Input placeholder="προαιρετικό · βοηθά στην αναζήτηση" className="h-[46px] rounded-xl" /></Field></div><Field label="Κύρια μυϊκή ομάδα" required><div className="flex flex-wrap gap-2">{muscles.map((item) => <Pill key={item} active={form.muscleGroup === item} onClick={() => onChange("muscleGroup", item)}>{item}</Pill>)}</div></Field><div className="grid gap-[14px] sm:grid-cols-2"><Field label="Εξοπλισμός" required><Input value={form.equipment} onChange={(e) => onChange("equipment", e.target.value)} placeholder="π.χ. Σωματικό βάρος" className="h-[46px] rounded-xl" /></Field><Field label="Επίπεδο"><div className="flex flex-wrap gap-2">{levels.map((item) => <Pill key={item} active={form.level === item} onClick={() => onChange("level", item)}>{item}</Pill>)}</div></Field></div><Field label="Τύπος"><div className="flex flex-wrap gap-2">{types.map((item) => <Pill key={item} active={form.type === item} onClick={() => onChange("type", item)}>{item}</Pill>)}</div></Field></FormCard>
      <FormCard index="2" title="Βίντεο & φωτογραφίες" description="Ο πελάτης τα βλέπει στην οθόνη της άσκησης"><Field label="Βίντεο" hint="Link YouTube ή Vimeo · προαιρετικό"><Input value={form.videoUrl} onChange={(e) => onChange("videoUrl", e.target.value)} placeholder="https://youtube.com/…" className="h-[46px] rounded-xl" /></Field><Field label="Φωτογραφίες" hint="Η πρώτη είναι το εξώφυλλο στη Βιβλιοθήκη"><div className="flex flex-wrap gap-3">{images.map((image, index) => <div key={image.id} className={cn("relative h-[150px] w-[150px] overflow-hidden rounded-[14px] bg-muted", index === 0 && "ring-3 ring-accent ring-inset")}><img src={resolveMediaUrl(image.imageUrl)} alt="" className="h-full w-full object-cover" />{index === 0 && <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-1 text-[10px] font-extrabold text-accent-foreground">Εξώφυλλο</span>}</div>)}<button type="button" onClick={onPickMedia} className="grid h-[150px] w-[150px] place-items-center gap-1.5 rounded-[14px] border-2 border-dashed border-border bg-muted/40 text-center text-xs font-extrabold text-muted-foreground"><Images className="size-5" />Πρόσθεσε<br />φωτογραφία</button><button type="button" onClick={onUploadClick} disabled={creating} className="grid h-[150px] w-[150px] place-items-center gap-1.5 rounded-[14px] border-2 border-dashed border-border bg-muted/40 text-center text-xs font-extrabold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"><Upload className="size-5" />Ανέβασε<br />φωτογραφία</button></div></Field><div className="rounded-[14px] bg-muted px-4 py-3 text-xs font-bold">Ο πελάτης θα δει: <span className="ml-2 rounded-full bg-accent px-3 py-1 text-accent-foreground">{form.videoUrl && images.length ? "Βίντεο + φωτογραφίες" : images.length > 1 ? "Slider φωτογραφιών" : images.length ? "Μία φωτογραφία" : "Μόνο βίντεο"}</span></div></FormCard>
      <FormCard index="3" title="Οδηγίες εκτέλεσης" description="Βήμα βήμα · ο πελάτης τις βλέπει αριθμημένα"><p className="text-[13px] font-extrabold">Οδηγίες</p><div className="space-y-2">{steps.map((step, index) => <div key={`step-${index}`} className="flex items-start gap-3.5 rounded-xl bg-muted px-4 py-2.5"><span className="shrink-0 pt-1 text-[#b5b5b5]">⠿</span><span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-[#0b0b0b] text-[11px] font-extrabold text-accent">{index + 1}</span><DeferredTextarea value={step} onCommit={(value) => setSteps(steps.map((current, currentIndex) => currentIndex === index ? value : current))} className="min-h-6 min-w-0 flex-1 resize-none border-0 bg-transparent p-0 pl-1 text-sm leading-[1.45] shadow-none focus-visible:ring-0" /><button type="button" onClick={() => setSteps(steps.filter((_, currentIndex) => currentIndex !== index))} aria-label="Διαγραφή βήματος" className="shrink-0 pt-1 text-muted-foreground hover:text-red-600">×</button></div>)}</div><button type="button" onClick={() => setSteps([...steps, ""])} className="flex h-[42px] w-full items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#d6d6d2] px-4 text-[13px] font-bold text-muted-foreground hover:border-foreground hover:text-foreground"><Plus className="size-4" />Πρόσθεσε βήμα</button><div className="pt-2"><p className="text-[13px] font-extrabold">Συχνά λάθη</p><p className="mt-0.5 text-xs text-muted-foreground">προαιρετικό · εμφανίζονται με κόκκινο θαυμαστικό</p><div className="mt-3 space-y-2">{mistakes.map((mistake, index) => <div key={`mistake-${index}`} className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-2.5"><span className="shrink-0 text-red-600">⚠</span><DeferredInput value={mistake} onCommit={(value) => setMistakes(mistakes.map((current, currentIndex) => currentIndex === index ? value : current))} className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 pl-1 text-sm shadow-none focus-visible:ring-0" /><button type="button" onClick={() => setMistakes(mistakes.filter((_, currentIndex) => currentIndex !== index))} aria-label="Διαγραφή λάθους" className="shrink-0 text-muted-foreground hover:text-red-600">×</button></div>)}</div><button type="button" onClick={() => setMistakes([...mistakes, ""])} className="mt-3 flex h-[42px] w-full items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#d6d6d2] px-4 text-[13px] font-bold text-muted-foreground hover:border-foreground hover:text-foreground"><Plus className="size-4" />Πρόσθεσε λάθος</button></div></FormCard>
    </div><aside className="space-y-5"><Card className="rounded-[20px] border-border bg-card p-5 shadow-none"><div className="flex justify-between"><b>Ετοιμότητα</b><b>{completed} / 4</b></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${completed * 25}%` }} /></div><div className="mt-4 space-y-3 text-[13px] font-bold">{["Όνομα & μυϊκή ομάδα", "Εξοπλισμός", "Βίντεο ή φωτογραφία", "Οδηγίες εκτέλεσης"].map((label, index) => <p key={label} className={cn("flex items-center gap-2", ready[index] ? "text-foreground" : "text-muted-foreground")}><span className={cn("grid size-5 place-items-center rounded-full", ready[index] ? "bg-accent text-accent-foreground" : "bg-muted")}>{ready[index] ? "✓" : ""}</span>{label}</p>)}</div></Card><Card className="overflow-hidden rounded-[20px] border-border bg-card p-5 shadow-none"><div className="mb-3 flex justify-between"><b>Όπως το βλέπει ο πελάτης</b><span className="text-[11px] font-extrabold tracking-[1px] text-muted-foreground">LIVE</span></div><div className="overflow-hidden rounded-[26px] border-[7px] border-[#0b0b0b] bg-white"><div className="h-48 bg-muted">{images[0] && <img src={resolveMediaUrl(images[0].imageUrl)} alt="" className="h-full w-full object-cover" />}</div><div className="space-y-2 p-4"><span className="inline-flex rounded-full bg-[var(--sp-lime-soft)] px-2 py-1 text-[11px] font-extrabold">{form.muscleGroup || "Μυϊκή ομάδα"}</span><h2 className="text-lg font-extrabold">{form.name || "Όνομα άσκησης"}</h2>{form.instructions.split("\n").filter(Boolean).slice(0, 3).map((step, index) => <p key={`${step}-${index}`} className="text-xs leading-5"><b>{index + 1}.</b> {step}</p>)}</div></div></Card>{!creating && <Button type="button" variant="outline" onClick={onDelete} disabled={saving} className="h-11 w-full rounded-full border-red-200 text-red-600 hover:border-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/70 dark:hover:bg-red-950/30"><Trash2 className="size-4" />Διαγραφή άσκησης</Button>}</aside></div>
  </section>;
}
function FormCard({ index, title, description, children }: { index: string; title: string; description: string; children: React.ReactNode }) { return <Card className="rounded-[20px] border-border bg-card p-[22px] shadow-none"><div className="mb-[18px] flex items-center gap-3"><span className="grid size-[30px] place-items-center rounded-full bg-foreground text-[13px] font-extrabold text-accent">{index}</span><div><h2 className="text-[17px] font-extrabold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div><div className="space-y-[18px]">{children}</div></Card>; }
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) { return <label className="block text-[13px] font-extrabold">{label} {required && <span className="text-red-600">*</span>}{hint && <small className="ml-1 block pt-0.5 text-xs font-medium text-muted-foreground">{hint}</small>}<span className="mt-2 block">{children}</span></label>; }
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("h-[34px] rounded-full px-[14px] text-[13px] font-extrabold", active ? "bg-[#0b0b0b] text-white" : "bg-muted text-[#3a3a3a]")}>{children}</button>; }

function DeferredTextarea({ value: initialValue, onCommit, className }: { value: string; onCommit: (value: string) => void; className?: string }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue]);
  return <Textarea value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => onCommit(value)} className={className} />;
}

function DeferredInput({ value: initialValue, onCommit, className }: { value: string; onCommit: (value: string) => void; className?: string }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue]);
  return <Input value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => onCommit(value)} className={className} />;
}

function SortableThumb({
  image,
  isPrimary,
  dragDisabled,
  deleteDisabled,
  onDelete,
}: {
  image: NormalizedExerciseImage;
  isPrimary: boolean;
  dragDisabled: boolean;
  deleteDisabled: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(image.id),
    disabled: dragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      className={cn(
        "group/thumb relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800",
        !dragDisabled && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "z-10 opacity-60",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resolveMediaUrl(image.imageUrl)} alt="" className="h-full w-full object-cover" draggable={false} />
      {isPrimary && <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium text-accent-foreground">1</span>}
      <button
        type="button"
        onClick={onDelete}
        onPointerDown={(event) => event.stopPropagation()}
        disabled={deleteDisabled}
        aria-label="Διαγραφή φωτογραφίας"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100 disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function AddImageTile({ onPickLibrary, onPickUpload }: { onPickLibrary: () => void; onPickUpload: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Προσθήκη εικόνας"
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-red-300 hover:text-red-600 dark:border-slate-700"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[10px] font-medium">Προσθήκη</span>
          </button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={onPickLibrary}>📁 Από Media Library</DropdownMenuItem>
        <DropdownMenuItem onClick={onPickUpload}>💻 Από τον υπολογιστή</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <Label className="block">
      <span className="w-full">
        <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 h-9 focus-visible:border-red-300"
        />
      </span>
    </Label>
  );
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const selectOptions = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <Select
        items={[{ value: UNSET_VALUE, label: "Επιλογή" }, ...selectOptions.map((option) => ({ value: option, label: option }))]}
        value={value || UNSET_VALUE}
        onValueChange={(next: string | null) => onChange(!next || next === UNSET_VALUE ? "" : next)}
      >
        <SelectTrigger className="mt-1 h-9 w-full focus-visible:border-red-300">
          <SelectValue placeholder="Επιλογή" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET_VALUE}>Επιλογή</SelectItem>
          {selectOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function PickerImage({ asset }: { asset: MediaAsset }) {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(asset.url);

  if (!src || failed) {
    return <div className="grid h-full place-items-center bg-slate-900 p-3 text-center text-xs font-bold text-white">{asset.title}</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={asset.title}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium dark:text-slate-50">{value}</div>
    </div>
  );
}

function VideoEmbed({ url }: { url?: string }) {
  const embedUrl = getVideoEmbedUrl(url);

  if (!url) {
    return (
      <div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        <Play className="mr-2 h-5 w-5" />
        Δεν έχει προστεθεί video ακόμα
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
        Το link αποθηκεύεται, αλλά δεν υποστηρίζεται embed preview για αυτόν τον τύπο URL.
      </div>
    );
  }

  return (
    <div className="mt-5 aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800">
      <iframe
        src={embedUrl}
        title="Exercise video"
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function getVideoEmbedUrl(url?: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
    return parsed.pathname.includes("/embed/") ? url : "";
  } catch {
    return "";
  }
}

export default function ExerciseFormPage({ exerciseId, forceEdit = false }: { exerciseId: string | null; forceEdit?: boolean }) {
  return (
    <ProtectedRoute>
      <ExerciseFormContent exerciseId={exerciseId} forceEdit={forceEdit} />
    </ProtectedRoute>
  );
}
