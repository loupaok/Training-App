"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  RefreshCw,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ImageOff,
  Upload,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import PaginationControls from "@/components/shared/pagination-controls";
import { useAuth } from "@/lib/auth/auth-context";
import { api, API_BASE_URL } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 40;

const FILTER_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Όλα" },
  { key: "hasImage", label: "Με εικόνα ✅" },
  { key: "noImage", label: "Χωρίς ❌" },
  { key: "chest", label: "Στήθος" },
  { key: "back", label: "Πλάτη" },
  { key: "legs", label: "Πόδια" },
  { key: "shoulders", label: "Ώμοι" },
  { key: "arms", label: "Χέρια" },
  { key: "abs", label: "Κοιλιακοί" },
  { key: "cardio", label: "Cardio" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
  { value: "muscle", label: "Μυϊκή Ομάδα" },
];

interface MediaExercise {
  id: number | string;
  name: string;
  muscleGroup: string;
  imageUrl: string | null;
}

interface MediaListResponse {
  items: MediaExercise[];
  total: number;
  page: number;
  limit: number;
}

interface MediaStats {
  total: number;
  withImage: number;
  withoutImage: number;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// api.upload() (lib/api/client.ts) is hardcoded to POST; the spec calls for
// PUT here, so this mirrors that helper locally rather than editing the
// shared client for one call site.
async function uploadReplaceImage(id: number | string, file: File): Promise<{ imageUrl: string }> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`${API_BASE_URL}/media/exercises/${id}/image`, {
    method: "PUT",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Το upload απέτυχε.");
  return data;
}

function MediaExercisesContent() {
  const { user, logout } = useAuth();

  const [items, setItems] = useState<MediaExercise[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<MediaStats>({ total: 0, withImage: 0, withoutImage: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("az");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<MediaExercise | null>(null);
  const [wgerOpen, setWgerOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter]);

  const loadStats = () => {
    api
      .get<MediaStats>("/media/stats")
      .then(setStats)
      .catch(() => {});
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (filter && filter !== "all") params.set("filter", filter);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", String(PAGE_LIMIT));

    api
      .get<MediaListResponse>(`/media/exercises?${params.toString()}`)
      .then((data) => {
        if (ignore) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err, "Δεν φορτώθηκαν οι ασκήσεις."));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, filter, sort, page]);

  const applyImageUpdate = (id: number | string, imageUrl: string | null) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, imageUrl } : item)));
    loadStats();
  };

  const removeImage = async (item: MediaExercise) => {
    if (!window.confirm(`Αφαίρεση εικόνας από "${item.name}";`)) return;
    try {
      await api.delete(`/media/exercises/${item.id}/image`);
      applyImageUpdate(item.id, null);
    } catch (err) {
      setError(getErrorMessage(err, "Δεν αφαιρέθηκε η εικόνα."));
    }
  };

  const toggleSelect = (id: number | string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const bulkRemoveImages = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Αφαίρεση εικόνας από ${selectedIds.size} ασκήσεις;`)) return;
    const ids = Array.from(selectedIds);
    await Promise.allSettled(ids.map((id) => api.delete(`/media/exercises/${id}/image`)));
    setItems((current) => current.map((item) => (selectedIds.has(item.id) ? { ...item, imageUrl: null } : item)));
    loadStats();
    clearSelection();
  };

  // Keyboard shortcuts: Escape closes whichever dialog is open (on top of
  // each Dialog's own native Escape handling, this also clears preview
  // state so re-opening always starts clean), arrow keys navigate the
  // preview, Delete removes the currently-selected bulk set.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (previewIndex != null) {
        if (event.key === "Escape") setPreviewIndex(null);
        if (event.key === "ArrowLeft") setPreviewIndex((i) => (i == null ? i : (i - 1 + items.length) % items.length));
        if (event.key === "ArrowRight") setPreviewIndex((i) => (i == null ? i : (i + 1) % items.length));
        return;
      }
      if (event.key === "Delete" && selectMode && selectedIds.size) {
        bulkRemoveImages();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewIndex, items.length, selectMode, selectedIds]);

  const clearFilters = () => {
    setSearch("");
    setFilter("all");
  };

  return (
    <CoachShell title="Media Library" user={user} logout={logout}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 -mx-6 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold dark:text-slate-50">Media Library</h1>
          <Badge variant="secondary" className="text-sm font-bold">
            {total}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup value={[view]} onValueChange={(value) => value[0] && setView(value[0] as "grid" | "list")}>
            <ToggleGroupItem value="grid" aria-label="Προβολή πλέγματος">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Προβολή λίστας">
              <ListIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={sort} onValueChange={(value) => value && setSort(value)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="gap-2 font-bold" onClick={() => setWgerOpen(true)}>
            <Download className="h-4 w-4" />
            Fetch from wger
          </Button>
          <Button
            type="button"
            variant={selectMode ? "default" : "outline"}
            className="gap-2 font-bold"
            onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
          >
            {selectMode ? "Ακύρωση επιλογής" : "Επιλογή πολλαπλών"}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
                  filter === tab.key
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="flex h-11 max-w-md items-center rounded-lg border border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Search className="mr-3 h-4 w-4 shrink-0 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Αναζήτηση άσκησης..."
            className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Σύνολο ασκήσεων" value={stats.total} tone="text-slate-900 dark:text-slate-50" />
        <StatCard label="Με εικόνα ✅" value={stats.withImage} tone="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Χωρίς εικόνα ❌" value={stats.withoutImage} tone="text-red-600 dark:text-red-400" />
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading && !items.length ? (
        <div className="mt-10 flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ImageOff className="h-12 w-12 text-slate-300 dark:text-slate-700" />
          <p className="text-lg font-bold dark:text-slate-50">Δεν βρέθηκαν εικόνες</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Δοκίμασε διαφορετική αναζήτηση ή φίλτρο.</p>
          <Button type="button" variant="outline" onClick={clearFilters} className="mt-2 font-bold">
            Καθαρισμός φίλτρων
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item, index) => (
            <GridCard
              key={item.id}
              item={item}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onPreview={() => setPreviewIndex(index)}
              onReplace={() => setReplaceTarget(item)}
              onRemove={() => removeImage(item)}
            />
          ))}
        </div>
      ) : (
        <Card className="mt-5 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14" />
                <TableHead>Άσκηση</TableHead>
                <TableHead>Μυϊκή Ομάδα</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead className="text-right">Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="h-10 w-10 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveMediaUrl(item.imageUrl)} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff className="m-2.5 h-5 w-5 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.muscleGroup}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.imageUrl ? (
                      <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">Έχει εικόνα</Badge>
                    ) : (
                      <Badge variant="secondary">Χωρίς εικόνα</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setReplaceTarget(item)} aria-label="Replace">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeImage(item)}
                        disabled={!item.imageUrl}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewIndex(index)} disabled={!item.imageUrl} aria-label="Preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {items.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4 overflow-hidden rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Εμφανίζονται {(page - 1) * PAGE_LIMIT + 1} έως {Math.min(page * PAGE_LIMIT, total)} από {total}
          </span>
          <PaginationControls
            totalItems={total}
            pageSize={PAGE_LIMIT}
            currentPage={page}
            onPageSizeChange={() => {}}
            onPageChange={setPage}
            itemLabel="ασκήσεις"
            variant="pages"
          />
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-56 right-0 z-30 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <span className="text-sm font-bold dark:text-slate-50">{selectedIds.size} εικόνες επιλεγμένες</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clearSelection} className="font-bold">
              Ακύρωση
            </Button>
            <Button type="button" onClick={bulkRemoveImages} className="gap-2 bg-red-600 font-bold text-white hover:bg-red-700">
              <Trash2 className="h-4 w-4" />
              Διαγραφή όλων
            </Button>
          </div>
        </div>
      )}

      <PreviewDialog items={items} index={previewIndex} onClose={() => setPreviewIndex(null)} onNavigate={setPreviewIndex} />
      <ReplaceImageDialog target={replaceTarget} onClose={() => setReplaceTarget(null)} onSaved={applyImageUpdate} />
      <WgerFetchDialog open={wgerOpen} onClose={() => setWgerOpen(false)} onApplied={() => { loadStats(); setPage((current) => current); }} />
    </CoachShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cn("mt-1 text-3xl font-bold", tone)}>{value}</div>
    </Card>
  );
}

function GridCard({
  item,
  selectMode,
  selected,
  onToggleSelect,
  onPreview,
  onReplace,
  onRemove,
}: {
  item: MediaExercise;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className="group relative overflow-hidden p-0 transition-transform hover:scale-[1.02]">
      {selectMode && (
        <div className="absolute left-2 top-2 z-10">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="bg-white" />
        </div>
      )}
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(item.imageUrl)} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/50 group-hover:opacity-100">
          <IconOverlayButton label="Replace" onClick={onReplace}>
            <RefreshCw className="h-4 w-4" />
          </IconOverlayButton>
          <IconOverlayButton label="Remove" onClick={onRemove} disabled={!item.imageUrl}>
            <Trash2 className="h-4 w-4" />
          </IconOverlayButton>
          <IconOverlayButton label="Preview" onClick={onPreview} disabled={!item.imageUrl}>
            <Eye className="h-4 w-4" />
          </IconOverlayButton>
        </div>
      </div>
      <div className="space-y-1 p-2.5">
        <div className="truncate text-sm font-medium" title={item.name}>
          {item.name}
        </div>
        <Badge variant="outline" className="gap-1 text-[10px]">
          🏷️ {item.muscleGroup}
        </Badge>
      </div>
    </Card>
  );
}

function IconOverlayButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-900 shadow transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PreviewDialog({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: MediaExercise[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const item = index != null ? items[index] : null;
  const [copied, setCopied] = useState(false);

  useEffect(() => setCopied(false), [item?.id]);

  const copyUrl = async () => {
    if (!item?.imageUrl) return;
    try {
      await navigator.clipboard.writeText(resolveMediaUrl(item.imageUrl));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in this context — non-critical, no-op
    }
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-3xl border-none bg-slate-950 p-0 text-white sm:max-w-3xl">
        {item && (
          <div className="relative flex flex-col">
            <DialogHeader className="sr-only">
              <DialogTitle>{item.name}</DialogTitle>
              <DialogDescription>{item.muscleGroup}</DialogDescription>
            </DialogHeader>

            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>

            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate((index! - 1 + items.length) % items.length)}
                  aria-label="Previous"
                  className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate((index! + 1) % items.length)}
                  aria-label="Next"
                  className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            <div className="flex h-[60vh] items-center justify-center bg-black p-4">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(item.imageUrl)} alt={item.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageOff className="h-16 w-16 text-slate-600" />
              )}
            </div>

            <div className="space-y-3 p-5">
              <div>
                <div className="text-lg font-bold">{item.name}</div>
                <Badge variant="outline" className="mt-1 border-white/20 text-white">
                  {item.muscleGroup}
                </Badge>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-2">
                <Input readOnly value={item.imageUrl ? resolveMediaUrl(item.imageUrl) : ""} className="h-8 border-none bg-transparent p-0 text-xs text-white/70 shadow-none focus-visible:ring-0" />
                <Button type="button" variant="ghost" size="icon-sm" onClick={copyUrl} className="shrink-0 text-white hover:bg-white/10" aria-label="Copy URL">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReplaceImageDialog({
  target,
  onClose,
  onSaved,
}: {
  target: MediaExercise | null;
  onClose: () => void;
  onSaved: (id: number | string, imageUrl: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFile(null);
    setPreviewUrl("");
    setError("");
    setDragActive(false);
  }, [target?.id]);

  const validateAndSet = (candidate: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(candidate.type)) {
      setError("Μόνο jpg, png ή webp.");
      return;
    }
    if (candidate.size > 2 * 1024 * 1024) {
      setError("Μέγιστο μέγεθος 2MB.");
      return;
    }
    setError("");
    setFile(candidate);
    setPreviewUrl(URL.createObjectURL(candidate));
  };

  const save = async () => {
    if (!target || !file) return;
    setSaving(true);
    setError("");
    try {
      const result = await uploadReplaceImage(target.id, file);
      onSaved(target.id, result.imageUrl);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Το upload απέτυχε."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Αντικατάσταση εικόνας</DialogTitle>
          <DialogDescription>{target?.name}</DialogDescription>
        </DialogHeader>

        {target?.imageUrl && !previewUrl && (
          <div className="h-32 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(target.imageUrl)} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) validateAndSet(dropped);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed text-center text-sm font-semibold transition-colors",
            dragActive ? "border-red-400 bg-red-50 dark:bg-red-500/10" : "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400",
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <>
              <Upload className="h-6 w-6" />
              Σύρε εδώ ή κάνε κλικ
              <span className="text-xs font-normal text-slate-400">jpg, png, webp · έως 2MB</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked) validateAndSet(picked);
            }}
          />
        </div>

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Ακύρωση
          </Button>
          <Button type="button" onClick={save} disabled={!file || saving}>
            {saving ? "Αποθήκευση..." : "Αποθήκευση"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface WgerCandidate {
  id: number | string;
  name: string;
  muscleGroup: string;
}

function WgerFetchDialog({ open, onClose, onApplied }: { open: boolean; onClose: () => void; onApplied: () => void }) {
  const [candidates, setCandidates] = useState<WgerCandidate[]>([]);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError("");
    setSelected(new Set());
    setLoading(true);
    api
      .get<MediaListResponse>(`/media/exercises?filter=noImage&limit=200`)
      .then((data) => setCandidates(data.items.map((item) => ({ id: item.id, name: item.name, muscleGroup: item.muscleGroup }))))
      .catch((err) => setError(getErrorMessage(err, "Δεν φορτώθηκαν οι ασκήσεις χωρίς εικόνα.")))
      .finally(() => setLoading(false));
  }, [open]);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(candidates.map((item) => item.id)) : new Set());
  };

  const toggleOne = (id: number | string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runFetch = async () => {
    if (!selected.size) return;
    setFetching(true);
    setError("");
    setResult(null);
    try {
      const response = await api.post<{ updated: { id: number | string }[]; notFound: { id: number | string }[] }>(
        "/media/fetch-from-wger",
        { exerciseIds: Array.from(selected) },
      );
      setResult({ updated: response.updated.length, notFound: response.notFound.length });
      setCandidates((current) => current.filter((item) => !response.updated.some((u) => u.id === item.id)));
      setSelected(new Set());
      onApplied();
    } catch (err) {
      setError(getErrorMessage(err, "Η λήψη από το wger απέτυχε."));
    } finally {
      setFetching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] w-full max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fetch from wger</DialogTitle>
          <DialogDescription>
            Αναζήτηση εικόνων στο wger.de βάσει ακριβούς ονόματος άσκησης. Δεν βρίσκουν όλες οι ασκήσεις αντιστοιχία —
            το wger δεν υποστηρίζει πλέον ασαφή αναζήτηση.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        {!loading && candidates.length > 0 && (
          <>
            <label className="flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-bold dark:border-slate-800">
              <Checkbox checked={selected.size === candidates.length} onCheckedChange={(checked) => toggleAll(checked === true)} />
              Επιλογή όλων ({candidates.length})
            </label>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {candidates.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleOne(item.id)} />
                  <span className="flex-1 truncate">{item.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {item.muscleGroup}
                  </Badge>
                </label>
              ))}
            </div>
          </>
        )}

        {!loading && !candidates.length && !result && (
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Όλες οι ασκήσεις έχουν ήδη εικόνα.</p>
        )}

        {fetching && <Progress value={60} className="animate-pulse" />}

        {result && (
          <div className="rounded-md bg-slate-50 px-4 py-3 text-sm font-semibold dark:bg-slate-800">
            Ενημερώθηκαν {result.updated}. Χωρίς αντιστοιχία: {result.notFound}.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Κλείσιμο
          </Button>
          <Button type="button" onClick={runFetch} disabled={!selected.size || fetching} className="gap-2 font-bold">
            <Download className="h-4 w-4" />
            {fetching ? "Λήψη..." : `Fetch selected from wger API (${selected.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MediaExercisesPage() {
  return (
    <ProtectedRoute allow="coach">
      <MediaExercisesContent />
    </ProtectedRoute>
  );
}
