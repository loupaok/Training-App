"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronDown, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

interface EditForm {
  name: string;
  muscleGroup: string;
  equipment: string;
  type: string;
  instructions: string;
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
    imageUrl: "",
    videoUrl: "",
  };
}

function editFormFrom(exercise: Exercise): EditForm {
  return {
    name: exercise.name || "",
    muscleGroup: exercise.muscleGroup || "",
    equipment: exercise.equipment || "",
    type: exercise.type || "Δύναμη",
    instructions: exercise.instructions || "",
    programsCount: exercise.programsCount || 0,
    imageUrl: exercise.imageUrl || "",
    videoUrl: exercise.videoUrl || "",
  };
}

function ExerciseFormContent({ exerciseId }: { exerciseId: string | null }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCreatingRoute = exerciseId === null;

  const [filters, setFilters] = useState<FiltersState>({ muscleGroups: [], equipment: [], types: [] });
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">(isCreatingRoute ? "edit" : "view");
  const [isCreating, setIsCreating] = useState(isCreatingRoute);
  const [loading, setLoading] = useState(!isCreatingRoute);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");

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
        setModalMode(searchParams.get("mode") === "edit" ? "edit" : "view");
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

  const saveExercise = async () => {
    if (!exercise || !editForm) return;
    setSaving(true);
    setMediaMessage("");

    try {
      const payload = {
        ...editForm,
        name: editForm.name?.trim() || "Νέα Άσκηση",
        muscleGroup: editForm.muscleGroup?.trim() || "Γενική",
        equipment: editForm.equipment?.trim() || "Χωρίς εξοπλισμό",
        type: editForm.type?.trim() || "Δύναμη",
        programsCount: Number(editForm.programsCount || 0),
      };

      const updated = isCreating
        ? await api.post<Exercise>("/exercises", payload)
        : await api.put<Exercise>(`/exercises/${exercise.id}`, payload);

      setExercise(updated);
      setEditForm(editFormFrom(updated));
      setMediaMessage(isCreating ? "Η άσκηση προστέθηκε στη βάση." : "Η άσκηση ενημερώθηκε στη βάση.");

      if (isCreating) {
        setIsCreating(false);
        router.replace(`/exercises/${updated.id}?mode=edit`);
      }
    } catch (error) {
      setMediaMessage(getErrorMessage(error, "Δεν αποθηκεύτηκαν οι αλλαγές της άσκησης."));
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = async () => {
    if (!exercise || isCreating) return;
    const confirmed = window.confirm(`Να διαγραφεί η άσκηση "${exercise.name}";`);
    if (!confirmed) return;

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

  const openMediaPicker = async () => {
    setMediaPickerOpen(true);
    setMediaSearch("");
    try {
      const assets = await api.get<MediaAsset[]>("/media");
      setMediaAssets(assets.filter((asset) => asset.assetType === "photo"));
    } catch {
      setMediaAssets([]);
    }
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

  const filteredMediaAssets = mediaAssets.filter((asset) => {
    return (
      !mediaSearch ||
      asset.title.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      asset.folderName?.toLowerCase().includes(mediaSearch.toLowerCase())
    );
  });

  const isReadOnly = modalMode === "view";
  const currentImages = exercise && editForm ? normalizeExerciseImages({ ...exercise, imageUrl: editForm.imageUrl }) : [];

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
      </div>

      {loadError && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>
      ) : exercise && editForm ? (
        <div className="mx-auto max-w-3xl pb-8">
          {/* TOP — two columns */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[35%_1fr]">
            {/* LEFT — image + gallery */}
            <div>
              <div className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                <ExerciseImageSlider exercise={{ ...exercise, name: editForm.name, imageUrl: editForm.imageUrl }} large />
                {!isReadOnly && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
                    <label
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-medium text-slate-900 shadow-sm",
                        isCreating ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white",
                      )}
                    >
                      🔄 Αλλαγή
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={uploadImage}
                        disabled={isCreating || saving}
                        className="hidden"
                      />
                    </label>
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

              {currentImages.length > 0 && (
                <ScrollArea className="mt-3 w-full whitespace-nowrap">
                  <div className="flex gap-2 pb-2">
                    {currentImages.map((image, index) => (
                      <div
                        key={`${image.id}-${image.imageUrl}`}
                        className="group/thumb relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveMediaUrl(image.imageUrl)} alt="" className="h-full w-full object-cover" />
                        {(image.isPrimary || image.imageUrl === editForm.imageUrl || index === 0) && (
                          <span className="absolute left-0.5 top-0.5 rounded bg-red-600 px-1 text-[8px] font-medium text-white">P</span>
                        )}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => deleteExerciseImage(image)}
                            disabled={saving || !image.id || String(image.id).startsWith("local")}
                            aria-label="Διαγραφή φωτογραφίας"
                            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}

              {!isReadOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={openMediaPicker}
                  className="mt-2 h-7 px-2 text-xs font-normal text-slate-500 hover:text-red-600 dark:text-slate-400"
                >
                  + Προσθήκη εικόνας
                </Button>
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
                  <Button onClick={saveExercise} disabled={saving} className="gap-2 px-6 font-medium">
                    💾 {saving ? "Αποθήκευση..." : isCreating ? "Προσθήκη Άσκησης" : "Αποθήκευση"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
        <DialogContent className="max-h-[88vh] w-full max-w-5xl overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Επιλογή από Media Library</DialogTitle>
            <DialogDescription>Διάλεξε φωτογραφία που είναι ήδη αποθηκευμένη στη βάση.</DialogDescription>
          </DialogHeader>
          <div>
            <Input
              value={mediaSearch}
              onChange={(event) => setMediaSearch(event.target.value)}
              placeholder="Αναζήτηση φωτογραφίας ή φακέλου..."
              className="h-12 focus-visible:border-red-300"
            />
            <div className="mt-5 grid max-h-[58vh] grid-cols-2 gap-4 overflow-y-auto pr-2 sm:grid-cols-4">
              {filteredMediaAssets.map((asset) => (
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
    <img src={src} alt={asset.title} onError={() => setFailed(true)} className="h-full w-full object-cover" />
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

export default function ExerciseFormPage({ exerciseId }: { exerciseId: string | null }) {
  return (
    <ProtectedRoute>
      <ExerciseFormContent exerciseId={exerciseId} />
    </ProtectedRoute>
  );
}
