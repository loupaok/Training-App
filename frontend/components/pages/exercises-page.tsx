"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  ImageOff,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  List as ListIcon,
  Dumbbell,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { ExerciseImage, normalizeExerciseImages, type Exercise } from "@/components/shared/exercise-visuals";

const PAGE_SIZE = 24;
const MUSCLE_GROUP_TABS = ["Στήθος", "Πλάτη", "Πόδια", "Ώμοι", "Δικέφαλοι", "Τρικέφαλοι", "Κοιλιακοί", "Γλουτοί", "Cardio"];
const EQUIPMENT_TABS = ["Μπάρα", "Αλτήρες", "Τροχαλία", "Μηχάνημα", "Σωματικό βάρος", "Λάστιχα", "Άλλο"];

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
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filters, setFilters] = useState<FiltersState>({ muscleGroups: [], equipment: [], types: [] });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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
    router.push(mode === "edit" ? `/exercises/${exercise.id}?mode=edit` : `/exercises/${exercise.id}`);
  };

  const openCreateExercise = () => {
    router.push("/exercises/new");
  };

  const deleteExercise = async (exercise: Exercise) => {
    if (!exercise || String(exercise.id).startsWith("fallback")) return;
    const confirmed = window.confirm(`Να διαγραφεί η άσκηση "${exercise.name}";`);
    if (!confirmed) return;

    try {
      await api.delete(`/exercises/${exercise.id}`);
      setExercises((items) => items.filter((item) => item.id !== exercise.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Δεν έγινε διαγραφή της άσκησης.");
    }
  };

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

        <Select
          items={[{ value: "all", label: "Όλοι" }, ...EQUIPMENT_TABS.map((option) => ({ value: option, label: option }))]}
          value={equipment || "all"}
          onValueChange={(value) => value && setEquipment(value === "all" ? "" : value)}
        >
          <SelectTrigger className="h-10 w-full gap-2 sm:w-64">
            <span className="text-slate-500 dark:text-slate-400">Εξοπλισμός:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλοι</SelectItem>
            {EQUIPMENT_TABS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
    </CoachShell>
  );
}

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
        active
          ? "border-red-500 bg-red-500 text-white"
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

function filterLocal(items: Exercise[], selectedFilters: { search: string; muscleGroup: string; equipment: string }): Exercise[] {
  const searchValue = selectedFilters.search.trim().toLowerCase();
  return items.filter((exercise) => {
    const matchesSearch =
      !searchValue || [exercise.name, exercise.muscleGroup, exercise.equipment].some((value) => value?.toLowerCase().includes(searchValue));
    const matchesMuscle = !selectedFilters.muscleGroup || exercise.muscleGroup === selectedFilters.muscleGroup;
    const matchesEquipment = !selectedFilters.equipment || exercise.equipment === selectedFilters.equipment;
    return matchesSearch && matchesEquipment && matchesMuscle;
  });
}

function uniqueOptions(items: Exercise[], key: "muscleGroup" | "equipment" | "type"): string[] {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
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
