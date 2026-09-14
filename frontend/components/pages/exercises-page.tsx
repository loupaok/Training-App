"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  Upload,
  Image as ImageIcon,
  Play,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Target,
  Box,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import PaginationControls from "@/components/shared/pagination-controls";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { compressImageFile } from "@/lib/image-compression";

const ALL_VALUE = "__all__";
const UNSET_VALUE = "__unset__";

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

interface Exercise {
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

const fallbackExercises: Exercise[] = [
  {
    id: "fallback-1",
    name: "Bench Press",
    muscleGroup: "Στήθος",
    equipment: "Μπάρα, Πάγκος",
    type: "Δύναμη",
    programsCount: 24,
    instructions: "Πίεσε τη μπάρα από το στήθος προς τα πάνω κρατώντας τις ωμοπλάτες σταθερές και τα πόδια πατημένα.",
  },
  {
    id: "fallback-2",
    name: "Back Squat",
    muscleGroup: "Τετρακέφαλοι",
    equipment: "Μπάρα",
    type: "Δύναμη",
    programsCount: 31,
    instructions: "Κράτα κορμό σταθερό, λύγισε γόνατα και ισχία, και ανέβα πιέζοντας όλο το πέλμα στο έδαφος.",
  },
];

function ExercisesContent() {
  const { user, logout } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filters, setFilters] = useState<FiltersState>({ muscleGroups: [], equipment: [], types: [] });
  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [isCreating, setIsCreating] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

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
      .catch(() =>
        setFilters({
          muscleGroups: uniqueOptions(fallbackExercises, "muscleGroup"),
          equipment: uniqueOptions(fallbackExercises, "equipment"),
          types: uniqueOptions(fallbackExercises, "type"),
        }),
      );
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setCurrentPage(1);

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (muscleGroup) params.set("muscleGroup", muscleGroup);
    if (equipment) params.set("equipment", equipment);

    api
      .get<Exercise[]>(`/exercises?${params.toString()}`)
      .then((data) => {
        if (!ignore) setExercises(data);
      })
      .catch(() => {
        if (!ignore) setExercises(filterLocal(fallbackExercises, { search, muscleGroup, equipment }));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [search, muscleGroup, equipment]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(exercises.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, exercises.length, pageSize]);

  const stats = useMemo(
    () => ({
      total: exercises.length,
      muscleGroups: filters.muscleGroups.length,
      equipment: filters.equipment.length,
      inPrograms: exercises.reduce((sum, exercise) => sum + Number(exercise.programsCount || 0), 0),
    }),
    [exercises, filters],
  );
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

  const paginatedExercises = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return exercises.slice(start, start + pageSize);
  }, [currentPage, exercises, pageSize]);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const openExercise = (exercise: Exercise, mode: "view" | "edit" = "view") => {
    setIsCreating(false);
    setModalMode(mode);
    setSelected(exercise);
    setImageUrl(exercise.imageUrl || "");
    setVideoUrl(exercise.videoUrl || "");
    setEditForm({
      name: exercise.name || "",
      muscleGroup: exercise.muscleGroup || "",
      equipment: exercise.equipment || "",
      type: exercise.type || "Δύναμη",
      instructions: exercise.instructions || "",
      programsCount: exercise.programsCount || 0,
      imageUrl: exercise.imageUrl || "",
      videoUrl: exercise.videoUrl || "",
    });
    setMediaMessage("");
  };

  const openCreateExercise = () => {
    const draft: Exercise = {
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
    setIsCreating(true);
    setModalMode("edit");
    setSelected(draft);
    setImageUrl("");
    setVideoUrl("");
    setEditForm({
      name: draft.name,
      muscleGroup: draft.muscleGroup,
      equipment: draft.equipment,
      type: draft.type,
      instructions: draft.instructions || "",
      programsCount: draft.programsCount || 0,
      imageUrl: draft.imageUrl || "",
      videoUrl: draft.videoUrl || "",
    });
    setMediaMessage("");
  };

  const updateSelected = (patch: Partial<Exercise>) => {
    setSelected((current) => (current ? { ...current, ...patch } : current));
    setExercises((items) => items.map((item) => (item.id === selected?.id ? { ...item, ...patch } : item)));
  };

  const updateExerciseImages = (images: RawExerciseImage[], preferredImageUrl = "") => {
    const normalizedImages = normalizeExerciseImages({ images, imageUrl: preferredImageUrl });
    const primaryImage = normalizedImages.find((image) => image.isPrimary) || normalizedImages[0];
    const nextImageUrl = preferredImageUrl || primaryImage?.imageUrl || "";
    setImageUrl(nextImageUrl);
    setEditForm((current) => (current ? { ...current, imageUrl: nextImageUrl } : current));
    updateSelected({
      imageUrl: nextImageUrl,
      images: normalizedImages,
      imageUrls: normalizedImages.map((image) => image.imageUrl),
    });
  };

  const saveMedia = async () => {
    if (!selected || String(selected.id).startsWith("fallback")) return;
    setSaving(true);
    setMediaMessage("");
    try {
      const response = await api.put<{ imageUrl: string; videoUrl: string }>(`/exercises/${selected.id}/media`, {
        imageUrl,
        videoUrl,
      });
      updateSelected({ imageUrl: response.imageUrl, videoUrl: response.videoUrl });
      setMediaMessage("Αποθηκεύτηκαν οι αλλαγές media στη βάση.");
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : "Δεν αποθηκεύτηκαν οι αλλαγές.");
    } finally {
      setSaving(false);
    }
  };

  const updateEditField = <K extends keyof EditForm>(field: K, value: EditForm[K]) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
    if (field === "imageUrl") setImageUrl(String(value));
    if (field === "videoUrl") setVideoUrl(String(value));
  };

  const saveExercise = async () => {
    if (!selected || !editForm || String(selected.id).startsWith("fallback")) return;
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
        : await api.put<Exercise>(`/exercises/${selected.id}`, payload);

      setSelected(updated);
      setIsCreating(false);
      setImageUrl(updated.imageUrl || "");
      setVideoUrl(updated.videoUrl || "");
      setEditForm({
        name: updated.name || "",
        muscleGroup: updated.muscleGroup || "",
        equipment: updated.equipment || "",
        type: updated.type || "Δύναμη",
        instructions: updated.instructions || "",
        programsCount: updated.programsCount || 0,
        imageUrl: updated.imageUrl || "",
        videoUrl: updated.videoUrl || "",
      });
      setExercises((items) => (isCreating ? [updated, ...items] : items.map((item) => (item.id === updated.id ? updated : item))));
      setMediaMessage(isCreating ? "Η άσκηση προστέθηκε στη βάση." : "Η άσκηση ενημερώθηκε στη βάση.");
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : "Δεν αποθηκεύτηκαν οι αλλαγές της άσκησης.");
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = async (exercise: Exercise | null = selected) => {
    if (!exercise || isCreating || String(exercise.id).startsWith("fallback")) return;
    const confirmed = window.confirm(`Να διαγραφεί η άσκηση "${exercise.name}";`);
    if (!confirmed) return;

    setSaving(true);
    setMediaMessage("");
    try {
      await api.delete(`/exercises/${exercise.id}`);
      setExercises((items) => items.filter((item) => item.id !== exercise.id));
      if (selected?.id === exercise.id) {
        setSelected(null);
        setEditForm(null);
      }
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : "Δεν έγινε διαγραφή της άσκησης.");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selected || String(selected.id).startsWith("fallback")) return;

    setSaving(true);
    setMediaMessage("Συμπίεση φωτογραφίας...");

    const compressedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append("image", compressedFile);

    try {
      const response = await api.upload<{ imageId?: string; imageUrl: string }>(`/exercises/${selected.id}/image`, formData);
      const nextImages: RawExerciseImage[] = [
        { id: response.imageId || `new-${Date.now()}`, imageUrl: response.imageUrl, isPrimary: true },
        ...normalizeExerciseImages(selected)
          .filter((image) => image.imageUrl !== response.imageUrl)
          .map((image) => ({ ...image, isPrimary: false })),
      ];
      updateExerciseImages(nextImages, response.imageUrl);
      setMediaMessage(`Η φωτογραφία συμπιέστηκε και προστέθηκε στο gallery. ${formatBytes(file.size)} → ${formatBytes(compressedFile.size)}`);
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : "Το upload απέτυχε.");
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

    if (isCreating || !selected || String(selected.id).startsWith("fallback")) {
      updateEditField("imageUrl", asset.url);
      setMediaMessage(`Επιλέχθηκε εικόνα από Media Library: ${asset.title}`);
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<{ images?: RawExerciseImage[] }>(`/exercises/${selected.id}/images`, {
        imageUrl: asset.url,
        primary: true,
      });
      updateExerciseImages(response.images || [], asset.url);
      setMediaMessage(`Προστέθηκε στο gallery από Media Library: ${asset.title}`);
    } catch (error) {
      updateEditField("imageUrl", asset.url);
      setMediaMessage(error instanceof Error ? error.message : "Δεν προστέθηκε η εικόνα στο gallery.");
    } finally {
      setSaving(false);
    }
  };

  const clearThumbnail = () => {
    updateEditField("imageUrl", "");
    setMediaMessage("Το thumbnail αφαιρέθηκε. Πάτησε αποθήκευση για να ενημερωθεί η άσκηση.");
  };

  const deleteExerciseImage = async (image: ExerciseImage) => {
    if (!image?.id || !selected || isCreating || String(image.id).startsWith("local") || String(selected.id).startsWith("fallback")) return;
    const confirmed = window.confirm("Να διαγραφεί αυτή η φωτογραφία από την άσκηση;");
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await api.delete<{ images?: RawExerciseImage[] }>(`/exercises/${selected.id}/images/${image.id}`);
      updateExerciseImages(response.images || []);
      setMediaMessage("Η φωτογραφία διαγράφηκε από την άσκηση.");
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : "Δεν διαγράφηκε η φωτογραφία.");
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
  const modalOpen = Boolean(selected && editForm);
  const currentImages = selected && editForm ? normalizeExerciseImages({ ...selected, imageUrl: editForm.imageUrl }) : [];

  return (
    <CoachShell title="Βιβλιοθήκη Ασκήσεων" user={user} logout={logout}>
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="font-semibold text-blue-600">
            Dashboard
          </Link>
          <span className="text-slate-400 dark:text-slate-500">›</span>
          <span className="text-slate-600 dark:text-slate-400">Βιβλιοθήκη Ασκήσεων</span>
        </div>
        <Button onClick={openCreateExercise} className="h-12 gap-3 px-6 font-bold shadow-lg shadow-red-200">
          <Plus className="h-5 w-5" />
          Προσθήκη Άσκησης
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 flex h-14 items-center rounded-lg border border-slate-200 bg-white px-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-4">
          <Search className="mr-3 h-5 w-5 text-slate-500 dark:text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Αναζήτηση άσκησης..."
            className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="col-span-6 md:col-span-3">
          <Select
            value={muscleGroup || ALL_VALUE}
            onValueChange={(value: string | null) => setMuscleGroup(!value || value === ALL_VALUE ? "" : value)}
          >
            <SelectTrigger className="h-14 w-full rounded-lg border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <SelectValue placeholder="Μυϊκή Ομάδα: Όλες" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Μυϊκή Ομάδα: Όλες</SelectItem>
              {filters.muscleGroups.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-6 md:col-span-3">
          <Select
            value={equipment || ALL_VALUE}
            onValueChange={(value: string | null) => setEquipment(!value || value === ALL_VALUE ? "" : value)}
          >
            <SelectTrigger className="h-14 w-full rounded-lg border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <SelectValue placeholder="Εξοπλισμός: Όλες" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Εξοπλισμός: Όλες</SelectItem>
              {filters.equipment.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSearch("");
            setMuscleGroup("");
            setEquipment("");
          }}
          className="col-span-12 h-14 gap-2 font-bold text-slate-700 shadow-sm hover:border-red-200 hover:text-red-600 md:col-span-2 dark:text-slate-200"
        >
          <Filter className="h-5 w-5" />
          Reset
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Σύνολο Ασκήσεων" value={stats.total} note="με ενεργά φίλτρα" tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" icon={<Dumbbell className="h-8 w-8" />} />
        <StatCard label="Μυϊκές Ομάδες" value={stats.muscleGroups} note="διαθέσιμες" tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" icon={<Target className="h-8 w-8" />} />
        <StatCard label="Εξοπλισμοί" value={stats.equipment} note="διαθέσιμοι" tone="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" icon={<Box className="h-8 w-8" />} />
        <StatCard label="Ασκήσεις σε Προγράμματα" value={stats.inPrograms} note="χρήσεις συνολικά" tone="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" icon={<BarChart3 className="h-8 w-8" />} />
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <PaginationControls
          totalItems={exercises.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageSizeChange={changePageSize}
          onPageChange={setCurrentPage}
          itemLabel="ασκήσεις"
          variant="summary"
        />
      </div>

      <Card className="mt-5 overflow-hidden" style={{ "--card-spacing": "0px" } as React.CSSProperties}>
        <Table>
          <TableHeader>
            <TableRow className="h-16 text-sm font-extrabold">
              <TableHead className="px-6">Άσκηση</TableHead>
              <TableHead className="px-5">Μυϊκή Ομάδα</TableHead>
              <TableHead className="px-5">Εξοπλισμός</TableHead>
              <TableHead className="px-5">Τύπος</TableHead>
              <TableHead className="px-5">Σε Προγράμματα</TableHead>
              <TableHead className="px-5">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedExercises.map((exercise) => (
              <TableRow key={exercise.id} className="h-[82px]">
                <TableCell className="px-6">
                  <Button
                    variant="link"
                    onClick={() => openExercise(exercise, "view")}
                    className="h-auto gap-4 whitespace-normal p-0 text-left font-extrabold text-slate-950 hover:text-red-600 dark:text-slate-50"
                  >
                    <ExerciseImage exercise={exercise} />
                    {exercise.name}
                  </Button>
                </TableCell>
                <TableCell className="px-5 text-sm text-slate-700 dark:text-slate-200">{exercise.muscleGroup}</TableCell>
                <TableCell className="px-5 text-sm text-slate-700 dark:text-slate-200">{exercise.equipment}</TableCell>
                <TableCell className="px-5 text-sm text-slate-700 dark:text-slate-200">{exercise.type}</TableCell>
                <TableCell className="px-5 text-sm font-bold text-slate-700 dark:text-slate-200">{exercise.programsCount || 0}</TableCell>
                <TableCell className="px-5">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Προβολή"
                      aria-label="Προβολή"
                      onClick={() => openExercise(exercise, "view")}
                      className="text-slate-900 hover:text-red-600 dark:text-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Επεξεργασία"
                      aria-label="Επεξεργασία"
                      onClick={() => openExercise(exercise, "edit")}
                      className="text-slate-900 hover:text-red-600 dark:text-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Διαγραφή"
                      aria-label="Διαγραφή"
                      onClick={() => deleteExercise(exercise)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && exercises.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 px-6 text-center font-semibold text-slate-500 dark:text-slate-400">
                  Δεν βρέθηκαν ασκήσεις με αυτά τα φίλτρα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <PaginationControls
          totalItems={exercises.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageSizeChange={changePageSize}
          onPageChange={setCurrentPage}
          itemLabel="ασκήσεις"
          variant="pages"
        />
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-full max-w-5xl overflow-y-auto sm:max-w-5xl">
          {selected && editForm && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{isCreating ? "Νέα Άσκηση" : editForm.name}</DialogTitle>
                <DialogDescription>
                  {editForm.muscleGroup} • {editForm.equipment}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                <div className="md:col-span-5">
                  <div className="h-72 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    <ExerciseImageSlider exercise={{ ...selected, name: editForm.name, imageUrl: editForm.imageUrl }} large />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Τύπος" value={editForm.type} />
                    <Info label="Σε Προγράμματα" value={editForm.programsCount || 0} />
                    <Info label="Video" value={editForm.videoUrl ? "Έτοιμο για embed" : "Δεν έχει μπει ακόμα"} />
                  </div>
                </div>
                <div className="md:col-span-7">
                  {isReadOnly ? (
                    <div>
                      <div className="grid grid-cols-2 gap-4">
                        <Info label="Όνομα" value={editForm.name} />
                        <Info label="Μυϊκή ομάδα" value={editForm.muscleGroup} />
                        <Info label="Εξοπλισμός" value={editForm.equipment} />
                        <Info label="Τύπος" value={editForm.type} />
                        <Info label="Σε προγράμματα" value={editForm.programsCount || 0} />
                      </div>
                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                        <h3 className="font-extrabold dark:text-slate-50">Περιγραφή / Πώς γίνεται</h3>
                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-200">
                          {editForm.instructions || "Δεν έχει προστεθεί περιγραφή."}
                        </p>
                      </div>
                      <VideoEmbed url={editForm.videoUrl} />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <EditInput label="Όνομα" value={editForm.name} onChange={(value) => updateEditField("name", value)} />
                        <EditSelect
                          label="Μυϊκή ομάδα"
                          value={editForm.muscleGroup}
                          onChange={(value) => updateEditField("muscleGroup", value)}
                          options={muscleGroupOptions}
                        />
                        <EditSelect
                          label="Εξοπλισμός"
                          value={editForm.equipment}
                          onChange={(value) => updateEditField("equipment", value)}
                          options={equipmentOptions}
                        />
                        <EditSelect
                          label="Τύπος"
                          value={editForm.type}
                          onChange={(value) => updateEditField("type", value)}
                          options={typeOptions}
                        />
                        <EditInput
                          label="Σε προγράμματα"
                          type="number"
                          value={editForm.programsCount}
                          onChange={(value) => updateEditField("programsCount", value)}
                        />
                      </div>

                      <Label className="mt-5 block">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Περιγραφή / Πώς γίνεται</span>
                      </Label>
                      <Textarea
                        value={editForm.instructions}
                        onChange={(event) => updateEditField("instructions", event.target.value)}
                        className="mt-2 min-h-40 w-full rounded-lg border-slate-200 bg-slate-50 p-4 text-sm leading-7 focus-visible:border-red-300 dark:border-slate-800 dark:bg-slate-800"
                      />

                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Φωτογραφίες άσκησης</span>
                          <Badge
                            variant={currentImages.length ? "default" : "secondary"}
                            className={currentImages.length ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}
                          >
                            {currentImages.length ? `${currentImages.length} εικόνες` : "Χωρίς εικόνα"}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={openMediaPicker}
                            className="h-11 gap-2 font-bold hover:border-red-200 hover:text-red-600"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Προσθήκη από Media Library
                          </Button>
                          <label
                            className={`flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold dark:border-slate-800 dark:bg-slate-900 ${
                              isCreating ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-red-200 hover:text-red-600"
                            }`}
                          >
                            <Upload className="h-4 w-4" />
                            Upload φωτογραφίας
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={uploadImage}
                              disabled={isCreating || saving}
                              className="hidden"
                            />
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={clearThumbnail}
                            disabled={!editForm.imageUrl || saving}
                            className="h-11 border-red-200 font-bold text-red-600 hover:bg-red-50"
                          >
                            Καθαρισμός primary
                          </Button>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {currentImages.map((image, index) => (
                            <div key={`${image.id}-${image.imageUrl}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                              <div className="relative h-24 bg-slate-100 dark:bg-slate-800">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={resolveMediaUrl(image.imageUrl)} alt="" className="h-full w-full object-cover" />
                                {(image.isPrimary || image.imageUrl === editForm.imageUrl || index === 0) && (
                                  <Badge className="absolute left-2 top-2 bg-red-600 text-[10px] font-black text-white">PRIMARY</Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                onClick={() => deleteExerciseImage(image)}
                                disabled={saving || !image.id || String(image.id).startsWith("local")}
                                className="h-9 w-full rounded-none text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              >
                                Διαγραφή
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Label className="mt-5 block">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Video link / embed</span>
                      </Label>
                      <Input
                        value={editForm.videoUrl}
                        onChange={(event) => updateEditField("videoUrl", event.target.value)}
                        placeholder="YouTube, Vimeo ή embed URL"
                        className="mt-2 h-11 focus-visible:border-red-300"
                      />

                      {mediaMessage && (
                        <div className="mt-3 rounded-md bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{mediaMessage}</div>
                      )}

                      <VideoEmbed url={editForm.videoUrl} />

                      <div className="mt-6 flex justify-end border-t border-slate-200 pt-5 dark:border-slate-800">
                        <Button onClick={saveExercise} disabled={saving} className="h-11 px-6 font-bold">
                          {saving ? "Αποθήκευση..." : isCreating ? "Προσθήκη Άσκησης" : "Αποθήκευση Άσκησης"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
        <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-11 focus-visible:border-red-300"
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
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <Select value={value || UNSET_VALUE} onValueChange={(next: string | null) => onChange(!next || next === UNSET_VALUE ? "" : next)}>
        <SelectTrigger className="mt-2 h-11 w-full focus-visible:border-red-300">
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

function StatCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-5">
        <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-full ${tone}`}>{icon}</span>
        <div>
          <p className="text-base font-semibold text-slate-600 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-extrabold">{value}</p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{note}</p>
        </div>
      </div>
    </Card>
  );
}

function normalizeExerciseImages(exercise: Partial<Exercise> = {}): ExerciseImage[] {
  const rawImages: RawExerciseImage[] = Array.isArray(exercise.images) ? exercise.images : [];
  const fromUrls: RawExerciseImage[] = Array.isArray(exercise.imageUrls)
    ? exercise.imageUrls.map((imageUrl, index) => ({ id: `local-${index}-${imageUrl}`, imageUrl, isPrimary: index === 0 }))
    : [];
  const images = rawImages.length ? rawImages : fromUrls;
  const hasPrimary = images.some((image) => image.imageUrl === exercise.imageUrl || image.isPrimary);
  const normalized: ExerciseImage[] = images
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

function ExerciseImageSlider({ exercise, large = false }: { exercise: Partial<Exercise>; large?: boolean }) {
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
            onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)}
            className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-slate-900 shadow hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setIndex((value) => (value + 1) % images.length)}
            className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-slate-900 shadow hover:bg-white"
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

function ExerciseImage({ exercise, large = false }: { exercise: Partial<Exercise>; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = large ? "h-full w-full" : "h-14 w-20 rounded-md";
  const firstImage = normalizeExerciseImages(exercise)[0];
  const src = resolveMediaUrl(firstImage?.imageUrl || exercise.imageUrl);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className={`${sizeClass} grid place-items-center bg-slate-900 p-2 text-center text-[10px] font-extrabold uppercase leading-tight text-white`}>
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

function PickerImage({ asset }: { asset: MediaAsset }) {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(asset.url);

  if (!src || failed) {
    return <div className="grid h-full place-items-center bg-slate-900 p-3 text-center text-xs font-extrabold uppercase text-white">{asset.title}</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={asset.title} onError={() => setFailed(true)} className="h-full w-full object-cover" />
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 font-bold dark:text-slate-50">{value}</div>
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

function filterLocal(items: Exercise[], selectedFilters: { search: string; muscleGroup: string; equipment: string }): Exercise[] {
  const searchValue = selectedFilters.search.trim().toLowerCase();
  return items.filter((exercise) => {
    const matchesSearch =
      !searchValue || [exercise.name, exercise.muscleGroup, exercise.equipment].some((value) => value?.toLowerCase().includes(searchValue));
    const matchesMuscle = !selectedFilters.muscleGroup || exercise.muscleGroup === selectedFilters.muscleGroup;
    const matchesEquipment = !selectedFilters.equipment || exercise.equipment === selectedFilters.equipment;
    return matchesSearch && matchesMuscle && matchesEquipment;
  });
}

function uniqueOptions(items: Exercise[], key: "muscleGroup" | "equipment" | "type"): string[] {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
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

export default function ExercisesPage() {
  return (
    <ProtectedRoute>
      <ExercisesContent />
    </ProtectedRoute>
  );
}
