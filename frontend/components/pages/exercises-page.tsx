"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  Image as ImageIcon,
  ImageOff,
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  List as ListIcon,
  Dumbbell,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { compressImageFile } from "@/lib/image-compression";
import { cn } from "@/lib/utils";

const ALL_VALUE = "__all__";
const UNSET_VALUE = "__unset__";
const PAGE_SIZE = 24;
const MUSCLE_GROUP_TABS = ["Στήθος", "Πλάτη", "Πόδια", "Ώμοι", "Δικέφαλοι", "Τρικέφαλοι", "Κοιλιακοί", "Γλουτοί", "Cardio"];
const EQUIPMENT_TABS = ["Μπάρα", "Αλτήρες", "Τροχαλία", "Μηχάνημα", "Σωματικό βάρος", "Λάστιχα", "Άλλο"];

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

type SortColumn = "name" | "muscleGroup" | "equipment" | null;

function ExercisesContent() {
  const { user, logout } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filters, setFilters] = useState<FiltersState>({ muscleGroups: [], equipment: [], types: [] });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const [currentPage, setCurrentPage] = useState(1);

  // ---- NEW: view toggle, no effect on data fetching/logic ----
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Debounced search (300ms) — was firing on every keystroke before.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

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
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (muscleGroup) params.set("muscleGroup", muscleGroup);
    if (equipment) params.set("equipment", equipment);

    api
      .get<Exercise[]>(`/exercises?${params.toString()}`)
      .then((data) => {
        if (!ignore) setExercises(data);
      })
      .catch(() => {
        if (!ignore) setExercises(filterLocal(fallbackExercises, { search: debouncedSearch, muscleGroup, equipment }));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, muscleGroup, equipment]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(exercises.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, exercises.length]);

  // Purely a display-order concern — sorts the same fetched array, doesn't refetch or mutate it.
  const sortedExercises = useMemo(() => {
    if (!sortColumn) return exercises;
    const copy = [...exercises];
    copy.sort((a, b) => {
      const cmp = String(a[sortColumn] || "").localeCompare(String(b[sortColumn] || ""), "el");
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [exercises, sortColumn, sortDirection]);

  const toggleSort = (column: Exclude<SortColumn, null>) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const stats = useMemo(
    () => ({
      total: exercises.length,
      withImage: exercises.filter((exercise) => Boolean(exercise.imageUrl)).length,
      withoutImage: exercises.filter((exercise) => !exercise.imageUrl).length,
    }),
    [exercises],
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

  const totalPages = Math.max(1, Math.ceil(sortedExercises.length / PAGE_SIZE));
  const paginatedExercises = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedExercises.slice(start, start + PAGE_SIZE);
  }, [currentPage, sortedExercises]);

  const clearFilters = () => {
    setSearch("");
    setMuscleGroup("");
    setEquipment("");
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
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold dark:text-slate-50">Βιβλιοθήκη Ασκήσεων</h1>
          <Badge variant="secondary" className="text-sm font-bold">
            {stats.total}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 w-64 items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Αναζήτηση άσκησης..."
              className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <ToggleGroup value={[view]} onValueChange={(value) => value[0] && setView(value[0] as "grid" | "list")}>
            <ToggleGroupItem value="grid" aria-label="Προβολή πλέγματος">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Προβολή λίστας">
              <ListIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={openCreateExercise} className="h-10 gap-2 px-5 font-bold">
            <Plus className="h-4 w-4" />
            Νέα Άσκηση
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            <FilterPill active={!muscleGroup} onClick={() => setMuscleGroup("")}>
              Όλα
            </FilterPill>
            {MUSCLE_GROUP_TABS.map((option) => (
              <FilterPill key={option} active={muscleGroup === option} onClick={() => setMuscleGroup(option)}>
                {option}
              </FilterPill>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            <FilterPill active={!equipment} onClick={() => setEquipment("")} variant="outline">
              Όλα
            </FilterPill>
            {EQUIPMENT_TABS.map((option) => (
              <FilterPill key={option} active={equipment === option} onClick={() => setEquipment(option)} variant="outline">
                {option}
              </FilterPill>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {(muscleGroup || equipment) && (
          <div className="flex flex-wrap items-center gap-2">
            {muscleGroup && (
              <Badge variant="secondary" className="gap-1.5 py-1.5 pl-2.5 pr-1.5 text-xs font-bold">
                🏷️ {muscleGroup}
                <button type="button" onClick={() => setMuscleGroup("")} aria-label="Αφαίρεση φίλτρου μυϊκής ομάδας" className="rounded-full p-0.5 hover:bg-slate-300/50 dark:hover:bg-slate-600/50">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {equipment && (
              <Badge variant="secondary" className="gap-1.5 py-1.5 pl-2.5 pr-1.5 text-xs font-bold">
                🏷️ {equipment}
                <button type="button" onClick={() => setEquipment("")} aria-label="Αφαίρεση φίλτρου εξοπλισμού" className="rounded-full p-0.5 hover:bg-slate-300/50 dark:hover:bg-slate-600/50">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10">
              Καθαρισμός όλων
            </Button>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Σύνολο" value={stats.total} note="ασκήσεις" tone="text-slate-900 dark:text-slate-50" />
        <StatCard label="Με εικόνα" value={stats.withImage} note="✅" tone="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Χωρίς εικόνα" value={stats.withoutImage} note="❌" tone="text-red-600 dark:text-red-400" />
      </div>

      {/* Content */}
      {!loading && !paginatedExercises.length ? (
        <div className="mt-10 flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Dumbbell className="h-12 w-12 text-slate-300 dark:text-slate-700" />
          <p className="text-lg font-bold dark:text-slate-50">Δεν βρέθηκαν ασκήσεις</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Δοκίμασε διαφορετικά φίλτρα</p>
          <Button type="button" variant="outline" onClick={clearFilters} className="mt-2 font-bold">
            Καθαρισμός φίλτρων
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paginatedExercises.map((exercise) => (
            <ExerciseGridCard
              key={exercise.id}
              exercise={exercise}
              onView={() => openExercise(exercise, "view")}
              onEdit={() => openExercise(exercise, "edit")}
              onDelete={() => deleteExercise(exercise)}
            />
          ))}
        </div>
      ) : (
        <Card className="mt-5 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="h-14 text-sm font-bold">
                <TableHead className="w-14 px-6">#</TableHead>
                <TableHead className="w-20">Εικόνα</TableHead>
                <SortableHead label="Όνομα" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableHead label="Μυϊκή ομάδα" column="muscleGroup" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableHead label="Εξοπλισμός" column="equipment" sortColumn={sortColumn} sortDirection={sortDirection} onSort={toggleSort} />
                <TableHead className="px-5 text-right">Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedExercises.map((exercise, index) => (
                <TableRow key={exercise.id} className="h-16">
                  <TableCell className="px-6 text-sm font-semibold text-slate-400">{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                  <TableCell>
                    <ExerciseThumb exercise={exercise} />
                  </TableCell>
                  <TableCell className="text-sm font-bold text-slate-950 dark:text-slate-50">
                    <button type="button" onClick={() => openExercise(exercise, "view")} className="text-left hover:text-red-600">
                      {exercise.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{exercise.muscleGroup}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{exercise.equipment}</Badge>
                  </TableCell>
                  <TableCell className="px-5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title="Προβολή" aria-label="Προβολή" onClick={() => openExercise(exercise, "view")} className="text-slate-900 hover:text-red-600 dark:text-slate-50">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Επεξεργασία" aria-label="Επεξεργασία" onClick={() => openExercise(exercise, "edit")} className="text-slate-900 hover:text-red-600 dark:text-slate-50">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Διαγραφή" aria-label="Διαγραφή" onClick={() => deleteExercise(exercise)} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {sortedExercises.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Εμφάνιση {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, sortedExercises.length)} από {sortedExercises.length}
          </span>
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text=""
                    aria-disabled={currentPage === 1}
                    className={currentPage === 1 ? "pointer-events-none opacity-40" : ""}
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage((page) => Math.max(1, page - 1));
                    }}
                  />
                </PaginationItem>
                {getPageItems(totalPages, currentPage).map((item, index) =>
                  item === "..." ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === currentPage}
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text=""
                    aria-disabled={currentPage === totalPages}
                    className={currentPage === totalPages ? "pointer-events-none opacity-40" : ""}
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage((page) => Math.min(totalPages, page + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-2xl">{isCreating ? "Νέα Άσκηση" : editForm.name || "Χωρίς όνομα"}</DialogTitle>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {editForm.muscleGroup && (
                        <Badge className="bg-red-50 text-red-700 hover:bg-red-50 dark:bg-red-500/10 dark:text-red-400">{editForm.muscleGroup}</Badge>
                      )}
                      {editForm.equipment && <Badge variant="outline">{editForm.equipment}</Badge>}
                    </div>
                  </div>
                  {isReadOnly && !isCreating && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setModalMode("edit")} className="gap-2 font-bold">
                      ✏️ Επεξεργασία
                    </Button>
                  )}
                </div>
                <DialogDescription className="sr-only">Στοιχεία άσκησης</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                {/* LEFT 40% — image + gallery */}
                <div className="md:col-span-5">
                  <div className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    <ExerciseImageSlider exercise={{ ...selected, name: editForm.name, imageUrl: editForm.imageUrl }} large />
                    {!isReadOnly && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
                        <label
                          className={cn(
                            "flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-bold text-slate-900 shadow",
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
                          className="flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-bold text-red-600 shadow hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          🗑️ Διαγραφή
                        </button>
                      </div>
                    )}
                  </div>

                  {(currentImages.length > 0 || !isReadOnly) && (
                    <ScrollArea className="mt-3 w-full whitespace-nowrap">
                      <div className="flex gap-2 pb-2">
                        {currentImages.map((image, index) => (
                          <div
                            key={`${image.id}-${image.imageUrl}`}
                            className="group/thumb relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={resolveMediaUrl(image.imageUrl)} alt="" className="h-full w-full object-cover" />
                            {(image.isPrimary || image.imageUrl === editForm.imageUrl || index === 0) && (
                              <span className="absolute left-0.5 top-0.5 rounded bg-red-600 px-1 text-[8px] font-bold text-white">P</span>
                            )}
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => deleteExerciseImage(image)}
                                disabled={saving || !image.id || String(image.id).startsWith("local")}
                                aria-label="Διαγραφή φωτογραφίας"
                                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={openMediaPicker}
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] font-bold text-slate-400 hover:border-red-300 hover:text-red-600 dark:border-slate-700"
                          >
                            + Προσθήκη
                          </button>
                        )}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  )}

                  {mediaMessage && (
                    <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{mediaMessage}</div>
                  )}
                </div>

                {/* RIGHT 60% — fields */}
                <div className="md:col-span-7">
                  {isReadOnly ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <Info label="Τύπος" value={editForm.type} />
                        <Info label="Σε προγράμματα" value={editForm.programsCount || 0} />
                      </div>
                      <div>
                        <h3 className="font-bold dark:text-slate-50">Περιγραφή / Πώς γίνεται</h3>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-200">
                          {editForm.instructions || "Δεν έχει προστεθεί περιγραφή."}
                        </p>
                      </div>
                      <Collapsible defaultOpen={Boolean(editForm.videoUrl)}>
                        <CollapsibleTrigger
                          render={
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <span>🎥 Βίντεο οδηγιών</span>
                              <ChevronDown className="h-4 w-4 transition-transform data-panel-open:rotate-180" />
                            </button>
                          }
                        />
                        <CollapsibleContent className="mt-3">
                          <VideoEmbed url={editForm.videoUrl} />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <EditInput label="Όνομα" value={editForm.name} onChange={(value) => updateEditField("name", value)} />
                      <div className="grid grid-cols-2 gap-4">
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
                      </div>
                      <div className="grid grid-cols-2 gap-4">
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

                      <div>
                        <Label className="block">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Περιγραφή</span>
                        </Label>
                        <Textarea
                          value={editForm.instructions}
                          onChange={(event) => updateEditField("instructions", event.target.value)}
                          className="mt-2 min-h-32 w-full rounded-lg border-slate-200 bg-slate-50 p-4 text-sm leading-7 focus-visible:border-red-300 dark:border-slate-800 dark:bg-slate-800"
                        />
                      </div>

                      <Collapsible defaultOpen={Boolean(editForm.videoUrl)}>
                        <CollapsibleTrigger
                          render={
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
                            >
                              <span>🎥 Βίντεο οδηγιών</span>
                              <ChevronDown className="h-4 w-4 transition-transform data-panel-open:rotate-180" />
                            </button>
                          }
                        />
                        <CollapsibleContent className="mt-3 space-y-3">
                          <Input
                            value={editForm.videoUrl}
                            onChange={(event) => updateEditField("videoUrl", event.target.value)}
                            placeholder="YouTube, Vimeo ή embed URL"
                            className="h-11 focus-visible:border-red-300"
                          />
                          <VideoEmbed url={editForm.videoUrl} />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </div>
              </div>

              {!isReadOnly && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    {!isCreating ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => deleteExercise(selected)}
                        disabled={saving}
                        className="gap-2 font-bold text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                      >
                        🗑️ Διαγραφή
                      </Button>
                    ) : (
                      <span />
                    )}
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setSelected(null)} className="font-bold">
                        Ακύρωση
                      </Button>
                      <Button onClick={saveExercise} disabled={saving} className="gap-2 px-6 font-bold">
                        💾 {saving ? "Αποθήκευση..." : isCreating ? "Προσθήκη Άσκησης" : "Αποθήκευση"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
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

function FilterPill({
  children,
  active,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  variant?: "default" | "outline";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
        active
          ? variant === "outline"
            ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
            : "border-red-500 bg-red-500 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
      )}
    >
      {children}
    </button>
  );
}

function SortableHead({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: {
  label: string;
  column: Exclude<SortColumn, null>;
  sortColumn: SortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: Exclude<SortColumn, null>) => void;
}) {
  const active = sortColumn === column;
  return (
    <TableHead>
      <button type="button" onClick={() => onSort(column)} className="flex items-center gap-1 font-bold hover:text-red-600">
        {label}
        {active ? (
          sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

function StatCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("text-3xl font-bold", tone)}>{value}</span>
        <span className="text-sm text-slate-400 dark:text-slate-500">{note}</span>
      </div>
    </Card>
  );
}

function ExerciseGridCard({
  exercise,
  onView,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group overflow-hidden p-0 transition-all hover:scale-[1.02] hover:shadow-lg">
      <button type="button" onClick={onView} className="relative block h-40 w-full overflow-hidden bg-slate-900">
        <ExerciseImage exercise={exercise} large />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
        {exercise.muscleGroup && (
          <Badge className="absolute bottom-2.5 left-2.5 bg-white/90 text-slate-900 hover:bg-white/90">{exercise.muscleGroup}</Badge>
        )}
      </button>
      <div className="p-4">
        <div className="truncate text-sm font-semibold" title={exercise.name}>
          {exercise.name}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {exercise.equipment} · {exercise.muscleGroup}
        </div>
        <div className="mt-3 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button type="button" variant="ghost" size="icon-sm" title="Επεξεργασία" aria-label="Επεξεργασία" onClick={onEdit} className="text-slate-900 hover:text-red-600 dark:text-slate-50">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Διαγραφή" aria-label="Διαγραφή" onClick={onDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  const [failed, setFailed] = useState(false);
  const firstImage = normalizeExerciseImages(exercise)[0];
  const src = resolveMediaUrl(firstImage?.imageUrl || exercise.imageUrl);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className="grid h-12 w-12 place-items-center rounded-md bg-slate-100 dark:bg-slate-800">
        <ImageOff className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-12 w-12 rounded-md object-cover" onError={() => setFailed(true)} />
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
      <Select
        items={[{ value: UNSET_VALUE, label: "Επιλογή" }, ...selectOptions.map((option) => ({ value: option, label: option }))]}
        value={value || UNSET_VALUE}
        onValueChange={(next: string | null) => onChange(!next || next === UNSET_VALUE ? "" : next)}
      >
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

function getPageItems(totalPages: number, currentPage: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export default function ExercisesPage() {
  return (
    <ProtectedRoute>
      <ExercisesContent />
    </ProtectedRoute>
  );
}
