"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";
import {
  Search,
  Upload,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  FolderInput,
  CheckSquare,
  Pencil,
  Save,
  ImagePlus,
  FileText,
  Grid2X2,
  List,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { MediaFolderTree, type MediaFolder } from "@/components/shared/media-folder-tree";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { compressImageFile } from "@/lib/image-compression";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface RawMediaItem {
  id: number | string;
  kind: "media_asset";
  title: string;
  url?: string;
  folderId?: number | string | null;
}

interface GalleryItem {
  id: string;
  entityId: number;
  title: string;
  url: string;
  folderId: number | null;
  kind: "asset";
}

interface MediaAssetItem {
  id: number;
  title: string;
  url: string;
  folderId: number | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isPdf(url?: string | null): boolean {
  return /\.pdf(?:$|[?#])/i.test(url || "");
}

function flattenFolderOptions(folders: MediaFolder[]): Array<{ id: number; label: string }> {
  const byParent = new Map<number | null, MediaFolder[]>();
  folders.forEach((folder) => {
    const list = byParent.get(folder.parentId) ?? [];
    list.push(folder);
    byParent.set(folder.parentId, list);
  });
  const result: Array<{ id: number; label: string }> = [];
  const walk = (parentId: number | null, depth: number) => {
    const children = (byParent.get(parentId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "el"));
    children.forEach((folder) => {
      result.push({ id: folder.id, label: `${"  ".repeat(depth)}${folder.name}` });
      walk(folder.id, depth + 1);
    });
  };
  walk(null, 0);
  return result;
}

function deletePathFor(item: GalleryItem): string {
  return `/media/media_asset/${item.entityId}`;
}

function replaceEndpointFor(item: GalleryItem): { path: string; field: string } {
  return { path: `/media/assets/${item.entityId}/file`, field: "file" };
}

function MediaGalleryContent() {
  const { user, logout } = useAuth();
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<GalleryItem | null>(null);
  const [moveTargetItems, setMoveTargetItems] = useState<GalleryItem[] | null>(null);
  const [editTarget, setEditTarget] = useState<GalleryItem | null>(null);
  const [replacingFile, setReplacingFile] = useState(false);


  // Client-side load-more window for the custom "Όλα τα αρχεία" view, which
  // (unlike the category views) has no server-side pagination — every asset
  // is already loaded, we just reveal it in pages of PAGE_SIZE.
  const [assetVisibleCount, setAssetVisibleCount] = useState(PAGE_SIZE);

  const fileInputRef = useRef<HTMLInputElement>(null);


  const loadLibrary = () => {
    setLoading(true);
    Promise.all([api.get<RawMediaItem[]>("/media"), api.get<MediaFolder[]>("/media/folders")])
      .then(([media, folderRows]) => {
        const mapped = media
          .filter((item) => item.kind === "media_asset" && item.url)
          .map((item) => ({
            id: Number(item.id),
            title: item.title,
            url: item.url as string,
            folderId: item.folderId === null || item.folderId === undefined || item.folderId === "" ? null : Number(item.folderId),
          }));
        setAssets(mapped);
        setFolders(folderRows);
      })
      .catch(() => {
        setAssets([]);
        setFolders([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  // Debounce search — matches the 300ms pattern used elsewhere in this app.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);


  const filteredAssetItems: GalleryItem[] = useMemo(() => {
    return assets
      .filter((asset) => {
        const matchesFolder = selectedFolderId === null || asset.folderId === selectedFolderId;
        const matchesSearch = !debouncedSearch || asset.title.toLowerCase().includes(debouncedSearch.toLowerCase());
        return matchesFolder && matchesSearch;
      })
      .map((asset) => ({ id: `asset-${asset.id}`, entityId: asset.id, title: asset.title, url: asset.url, folderId: asset.folderId, kind: "asset" as const }));
  }, [assets, selectedFolderId, debouncedSearch]);

  // Reset the reveal window whenever the underlying filtered set changes, so
  // switching folders/searching doesn't leave a stale "load more" position.
  useEffect(() => {
    setAssetVisibleCount(PAGE_SIZE);
  }, [selectedFolderId, debouncedSearch]);

  const displayItems: GalleryItem[] = useMemo(() => {
    return filteredAssetItems.slice(0, assetVisibleCount);
  }, [filteredAssetItems, assetVisibleCount]);

  const canLoadMoreAssets = assetVisibleCount < filteredAssetItems.length;

  const breadcrumbChain = useMemo(() => {
    if (selectedFolderId === null) return [];
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const chain: MediaFolder[] = [];
    let current = byId.get(selectedFolderId);
    while (current) {
      chain.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }, [folders, selectedFolderId]);

  const toggleSelect = (id: string) => {
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

  const createFolder = async (name: string, parentId: number | null) => {
    try {
      const created = await api.post<MediaFolder>("/media/folders", { name, parentId });
      setFolders((current) => [...current, { ...created, itemCount: 0 }]);
      toast.success(`Ο φάκελος "${name}" δημιουργήθηκε.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν δημιουργήθηκε ο φάκελος."));
    }
  };

  const renameFolder = async (id: number, name: string) => {
    try {
      await api.put(`/media/folders/${id}`, { name });
      setFolders((current) => current.map((folder) => (folder.id === id ? { ...folder, name } : folder)));
      toast.success("Ο φάκελος μετονομάστηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε μετονομασία φακέλου."));
    }
  };

  const confirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const target = deleteFolderTarget;
    setDeleteFolderTarget(null);
    try {
      await api.delete(`/media/folders/${target.id}`);
      toast.success(`Ο φάκελος "${target.name}" διαγράφηκε.`);
      if (selectedFolderId === target.id) setSelectedFolderId(target.parentId);
      loadLibrary();
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε διαγραφή φακέλου."));
    }
  };

  const refreshAfterMove = (folderId: number) => {
    loadLibrary();
    const folderName = folderId ? folders.find((folder) => folder.id === folderId)?.name : "Όλα τα αρχεία";
    toast.success(`Μετακινήθηκε στον φάκελο ${folderName || ""}`.trim());
  };

  const moveItems = async (items: GalleryItem[], folderId: number) => {
    if (!items.length) return;
    const assetIds = items.map((item) => item.entityId);

    try {
      if (assetIds.length === 1) {
        await api.put(`/media/assets/${assetIds[0]}/folder`, { folderId });
      } else {
        await api.put("/media/assets/bulk-move", { ids: assetIds, folderId });
      }
      setAssets((current) => current.map((asset) => (assetIds.includes(asset.id) ? { ...asset, folderId } : asset)));
      refreshAfterMove(folderId);
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε μετακίνηση."));
    }
  };

  const saveEdit = async (item: GalleryItem, title: string, folderId: number | null) => {
    const trimmedTitle = title.trim();
    const titleChanged = trimmedTitle && trimmedTitle !== item.title;
    const folderChanged = folderId !== item.folderId;

    try {
      if (titleChanged) {
        await api.put(`/media/media_asset/${item.entityId}`, { title: trimmedTitle });
      }
      if (folderChanged) {
        await api.put(`/media/assets/${item.entityId}/folder`, { folderId });
      }
      setAssets((current) =>
        current.map((asset) =>
          asset.id === item.entityId
            ? { ...asset, title: titleChanged ? trimmedTitle : asset.title, folderId: folderChanged ? folderId : asset.folderId }
            : asset,
        ),
      );
      loadLibrary();
      setEditTarget(null);
      toast.success("Η φωτογραφία ενημερώθηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε ενημέρωση."));
    }
  };

  const replacePhotoFile = async (item: GalleryItem, file: File) => {
    setReplacingFile(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 1800, maxHeight: 1800, quality: 0.84 });
      const { path, field } = replaceEndpointFor(item);
      const formData = new FormData();
      formData.append(field, compressed);
      const response = await api.upload<{ imageUrl?: string; url?: string }>(path, formData, "PUT");
      const newUrl = response.imageUrl || response.url || "";

      if (item.kind === "asset" && newUrl) {
        setAssets((current) => current.map((asset) => (asset.id === item.entityId ? { ...asset, url: newUrl } : asset)));
      }
      if (newUrl) {
        setEditTarget((current) => (current && current.id === item.id ? { ...current, url: newUrl } : current));
      }
      loadLibrary();
      toast.success("Η φωτογραφία αντικαταστάθηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε αντικατάσταση της φωτογραφίας."));
    } finally {
      setReplacingFile(false);
    }
  };

  const deleteItem = async (item: GalleryItem) => {
    try {
      await api.delete(deletePathFor(item));
      setAssets((current) => current.filter((asset) => asset.id !== item.entityId));
      loadLibrary();
      toast.success("Η φωτογραφία διαγράφηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε διαγραφή."));
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    const target = deleteItemTarget;
    setDeleteItemTarget(null);
    await deleteItem(target);
  };

  const bulkDelete = async () => {
    const items = displayItems.filter((item) => selectedIds.has(item.id));
    if (!items.length) return;
    const confirmed = window.confirm(`Να διαγραφούν ${items.length} φωτογραφίες;`);
    if (!confirmed) return;
    await Promise.all(items.map((item) => api.delete(deletePathFor(item)).catch(() => null)));
    const removedIds = new Set(items.map((item) => item.entityId));
    setAssets((current) => current.filter((asset) => !removedIds.has(asset.id)));
    loadLibrary();
    toast.success(`${items.length} φωτογραφίες διαγράφηκαν.`);
    clearSelection();
  };

  const uploadFilesToFolder = async (files: File[], folderId: number | null) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;


    setUploading(true);
    let succeeded = 0;
    let skipped = 0;
    // Track titles claimed by this same batch too, not just already-loaded
    // state, so dropping the same file (or duplicate files) together doesn't
    // upload it twice in a row.
    const claimedTitles = new Set(
      assets.filter((asset) => asset.folderId === folderId).map((asset) => asset.title.toLowerCase()),
    );

    for (const file of imageFiles) {
      const derivedTitle = file.name.replace(/\.[^.]+$/, "");
      if (claimedTitles.has(derivedTitle.toLowerCase())) {
        skipped += 1;
        continue;
      }

      try {
        const compressed = await compressImageFile(file, { maxWidth: 1800, maxHeight: 1800, quality: 0.84 });
        const formData = new FormData();
        formData.append("file", compressed);
        formData.append("title", derivedTitle);
        formData.append("assetType", "photo");
        if (folderId !== null) formData.append("folderId", String(folderId));
        const created = await api.upload<{ id: number; title: string; url: string; folderId: number | string | null }>("/media/upload", formData);
        // The upload endpoint echoes back folderId as whatever FormData sent (a
        // string), unlike GET /media which normalizes it — normalize here too,
        // or folder-scoped filters/dedup checks silently stop matching this
        // item until the next full reload.
        const createdFolderId = created.folderId === null || created.folderId === undefined || created.folderId === "" ? null : Number(created.folderId);
        setAssets((current) => [{ id: created.id, title: created.title, url: created.url, folderId: createdFolderId }, ...current]);
        claimedTitles.add(derivedTitle.toLowerCase());
        succeeded += 1;
      } catch (error) {
        toast.error(getErrorMessage(error, `Το upload του "${file.name}" απέτυχε.`));
      }
    }
    if (succeeded && folderId !== null) {
      setFolders((current) => current.map((folder) => (folder.id === folderId ? { ...folder, itemCount: folder.itemCount + succeeded } : folder)));
    }
    if (succeeded) {
      toast.success(succeeded === 1 ? "Η φωτογραφία ανέβηκε." : `${succeeded} φωτογραφίες ανέβηκαν.`);
    }
    if (skipped) {
      toast.error(skipped === 1 ? "Η φωτογραφία υπάρχει ήδη σε αυτόν τον φάκελο." : `${skipped} φωτογραφίες υπάρχουν ήδη σε αυτόν τον φάκελο.`);
    }
    setUploading(false);
  };

  const uploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFilesToFolder([file], selectedFolderId);
    event.target.value = "";
  };

  const handleTreeFileDrop = (folderId: number | null, files: FileList) => {
    uploadFilesToFolder(Array.from(files), folderId);
  };

  const [contentDropActive, setContentDropActive] = useState(false);
  const handleContentDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    setContentDropActive(false);
    if (event.dataTransfer.files.length) uploadFilesToFolder(Array.from(event.dataTransfer.files), selectedFolderId);
  };

  const moveDialogFolders = folders;

  return (
    <CoachShell title="Media" user={user} logout={logout}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[28px] font-extrabold tracking-[-.5px]">Media</h1><p className="mt-1 text-sm text-muted-foreground">Φωτογραφίες οργανωμένες σε φακέλους για όλη την εφαρμογή.</p></div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 rounded-xl border border-border bg-card p-1">
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setView("list")} aria-label="Προβολή λίστας" className={cn("size-7 rounded-[8px]", view === "list" && "bg-foreground text-background hover:bg-foreground hover:text-background")}><List className="size-4" /></Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setView("grid")} aria-label="Προβολή πλέγματος" className={cn("size-7 rounded-[8px]", view === "grid" && "bg-foreground text-background hover:bg-foreground hover:text-background")}><Grid2X2 className="size-4" /></Button>
          </div>
          {selectMode ? (
            <Button type="button" variant="outline" size="sm" onClick={clearSelection} className="font-medium">
              Ακύρωση επιλογής
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectMode(true)} className="gap-2 font-medium">
              <CheckSquare className="h-4 w-4" /> Επιλογή πολλαπλών
            </Button>
          )}
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2 bg-primary font-medium hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" /> {uploading ? "Ανέβασμα…" : "Προσθήκη media"}
            </Button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadFile} className="hidden" />
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="relative mt-6 min-h-[680px] overflow-hidden rounded-[22px] border border-border bg-card shadow-none before:absolute before:left-3 before:top-3 before:z-10 before:size-2 before:border-l before:border-t before:border-foreground after:absolute after:bottom-3 after:right-3 after:z-10 after:size-2 after:border-b after:border-r after:border-foreground">
        <ResizablePanel defaultSize="22" minSize="16" maxSize="35" className="flex flex-col overflow-hidden bg-muted/30">
          <MediaFolderTree
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelect={setSelectedFolderId}
            onCreate={createFolder}
            onRename={renameFolder}
            onDelete={setDeleteFolderTarget}
            onFileDrop={handleTreeFileDrop}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="78" className="flex flex-col overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border bg-card p-5">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  {selectedFolderId === null ? (
                    <BreadcrumbPage>Όλα</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink onClick={() => setSelectedFolderId(null)}>Όλα</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {breadcrumbChain.map((folder, index) => (
                  <Fragment key={folder.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === breadcrumbChain.length - 1 ? (
                        <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink onClick={() => setSelectedFolderId(folder.id)}>{folder.name}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex h-11 w-full max-w-md items-center rounded-xl border border-input bg-muted/30 px-3 shadow-none">
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Αναζήτηση φωτογραφίας..."
                className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div
            onDragOver={(event) => {
              if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
            }}
            onDragEnter={(event) => {
              if (event.dataTransfer?.types?.includes("Files")) setContentDropActive(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setContentDropActive(false);
            }}
            onDrop={handleContentDrop}
            className={cn("relative flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-5", contentDropActive && "bg-red-50/60 dark:bg-red-500/5")}
          >
            {contentDropActive && (
              <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-red-400 bg-white/70 text-sm font-semibold text-red-600 dark:bg-slate-950/70">
                Άσε το αρχείο εδώ για ανέβασμα
              </div>
            )}
            {loading ? (
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>
            ) : !displayItems.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <ImageOff className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <p className="font-semibold text-slate-500 dark:text-slate-400">Δεν βρέθηκαν φωτογραφίες.</p>
              </div>
            ) : (
              <>
                <div className={cn(view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "space-y-2")}>
                  {displayItems.map((item, index) => (
                    <GalleryCard
                      key={item.id}
                      item={item}
                      view={view}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onPreview={() => setPreviewIndex(index)}
                      onMove={() => setMoveTargetItems([item])}
                      onDelete={() => setDeleteItemTarget(item)}
                      onEdit={() => setEditTarget(item)}
                    />
                  ))}
                </div>
                {canLoadMoreAssets && (
                  <Button
                    type="button"
                    onClick={() => setAssetVisibleCount((current) => current + PAGE_SIZE)}
                    className="mt-4 w-full bg-gray-800 py-3 font-medium text-white dark:bg-zinc-800"
                  >
                    {`Εμφάνιση περισσότερων (${filteredAssetItems.length - assetVisibleCount} ακόμα)`}
                  </Button>
                )}
              </>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg dark:bg-slate-800">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{selectedIds.size} εικόνες επιλεγμένες</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setMoveTargetItems(displayItems.filter((item) => selectedIds.has(item.id)))}
              className="gap-2 text-white hover:bg-white/10 hover:text-white"
            >
              <FolderInput className="h-4 w-4" /> Μετακίνηση
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={bulkDelete} className="gap-2 text-red-300 hover:bg-white/10 hover:text-red-200">
              <Trash2 className="h-4 w-4" /> Διαγραφή
            </Button>
          </div>
        </div>
      )}

      <PreviewDialog items={displayItems} index={previewIndex} onClose={() => setPreviewIndex(null)} onNavigate={setPreviewIndex} />

      <AlertDialog open={Boolean(deleteItemTarget)} onOpenChange={(open) => !open && setDeleteItemTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή φωτογραφίας;</AlertDialogTitle>
            <AlertDialogDescription>Η «{deleteItemTarget?.title}» θα διαγραφεί οριστικά από τη Media Library.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteItem()} className="bg-red-600 text-white hover:bg-red-700">Ναι, διαγραφή</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteFolderTarget)} onOpenChange={(open) => !open && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή φακέλου {deleteFolderTarget?.name};</AlertDialogTitle>
            <AlertDialogDescription>Οι εικόνες θα μεταφερθούν στον γονικό φάκελο.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFolder} className="bg-red-600 hover:bg-red-700">
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={moveTargetItems !== null} onOpenChange={(open) => !open && setMoveTargetItems(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Μετακίνηση σε...</DialogTitle>
            <DialogDescription>
              {moveTargetItems?.length || 0} {(moveTargetItems?.length || 0) === 1 ? "εικόνα" : "εικόνες"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 rounded-md border border-slate-200 dark:border-slate-800">
            <MediaFolderTree
              folders={moveDialogFolders}
              selectedFolderId={null}
              onSelect={(folderId) => {
                if (moveTargetItems && folderId !== null) moveItems(moveTargetItems, folderId);
                setMoveTargetItems(null);
              }}
              onCreate={createFolder}
              onRename={renameFolder}
              onDelete={setDeleteFolderTarget}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <EditPhotoDialog
        item={editTarget}
        folders={folders}
        onClose={() => setEditTarget(null)}
        onSave={saveEdit}
        onReplaceFile={replacePhotoFile}
        replacing={replacingFile}
      />
    </CoachShell>
  );
}

function GalleryCard({
  item,
  view,
  selectMode,
  selected,
  onToggleSelect,
  onPreview,
  onMove,
  onDelete,
  onEdit,
}: {
  item: GalleryItem;
  view: "list" | "grid";
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onMove: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const src = resolveMediaUrl(item.url);
  const [failed, setFailed] = useState(false);
  const document = isPdf(item.url);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<Card className={cn("group relative overflow-hidden rounded-[16px] border-border bg-card p-0 shadow-none transition-colors hover:border-foreground", selected && "border-accent ring-2 ring-accent")} />}
      >
        <div role="button" tabIndex={0} onClick={selectMode ? onToggleSelect : onPreview} onKeyDown={(event) => { if (event.key === "Enter") (selectMode ? onToggleSelect : onPreview)(); }} className={cn("min-w-0", view === "grid" ? "flex flex-col gap-0" : "flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5")}>
          {selectMode && <Checkbox checked={selected} onCheckedChange={onToggleSelect} onClick={(event) => event.stopPropagation()} className="shrink-0" />}
          <div className={cn("relative grid shrink-0 place-items-center overflow-hidden bg-muted", view === "grid" ? "aspect-square w-full rounded-t-[15px]" : "size-14 rounded-[12px] sm:size-16")}>
            {document ? <FileText className="size-6 text-muted-foreground" /> : !src || failed ? <ImageOff className="size-6 text-muted-foreground" /> : <img src={src} alt={item.title} onError={() => setFailed(true)} loading="lazy" className="h-full w-full object-cover" />}
            {!selectMode && view === "grid" && <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} aria-label={`Διαγραφή ${item.title}`} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-red-600"><Trash2 className="size-4" /></button>}
          </div>
          <div className={cn("min-w-0", view === "grid" ? "w-full p-3" : "flex-1")}><p className="truncate text-sm font-extrabold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{document ? "Έγγραφο PDF" : "Φωτογραφία"} · Media Library</p></div>
          {!selectMode && <div className="flex shrink-0 items-center gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={(event) => { event.stopPropagation(); onPreview(); }} aria-label="Προεπισκόπηση" className="rounded-full"><Eye className="size-4" /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={(event) => { event.stopPropagation(); onMove(); }} aria-label="Μετακίνηση" className="hidden rounded-full sm:inline-flex"><FolderInput className="size-4" /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={(event) => { event.stopPropagation(); onEdit(); }} aria-label="Επεξεργασία" className="rounded-full"><Pencil className="size-4" /></Button></div>}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onPreview}>
          <Eye className="h-4 w-4" /> Προεπισκόπηση
        </ContextMenuItem>
        <ContextMenuItem onClick={onMove}>
          <FolderInput className="h-4 w-4" /> Μετακίνηση σε...
        </ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" /> Επεξεργασία
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Διαγραφή
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function PreviewDialog({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const open = index !== null;
  const item = index !== null ? items[index] : null;

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index !== null && index > 0) onNavigate(index - 1);
      if (event.key === "ArrowRight" && index !== null && index < items.length - 1) onNavigate(index + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, items.length]);

  if (!item || index === null) return null;
  const src = resolveMediaUrl(item.url);
  const document = isPdf(item.url);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] w-full max-w-4xl overflow-hidden bg-black/95 p-0 sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>Προεπισκόπηση φωτογραφίας</DialogDescription>
        </DialogHeader>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="h-5 w-5 text-white" />
        </button>
        <div className="relative flex h-[80vh] items-center justify-center">
          {document ? <iframe title={item.title} src={src} className="h-full w-full bg-white" /> : <img src={src} alt={item.title} className="max-h-full max-w-full object-contain" />}
          {index > 0 && (
            <button type="button" onClick={() => onNavigate(index - 1)} aria-label="Previous" className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
          )}
          {index < items.length - 1 && (
            <button type="button" onClick={() => onNavigate(index + 1)} aria-label="Next" className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 bg-black/60 px-4 py-3 text-white">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <Badge variant="secondary">{index + 1} / {items.length}</Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditPhotoDialog({
  item,
  folders,
  onClose,
  onSave,
  onReplaceFile,
  replacing,
}: {
  item: GalleryItem | null;
  folders: MediaFolder[];
  onClose: () => void;
  onSave: (item: GalleryItem, title: string, folderId: number | null) => void;
  onReplaceFile: (item: GalleryItem, file: File) => void;
  replacing: boolean;
}) {
  const [title, setTitle] = useState("");
  const [folderValue, setFolderValue] = useState("root");
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setFolderValue(item.folderId === null ? "root" : String(item.folderId));
  }, [item]);

  if (!item) return null;
  const options = flattenFolderOptions(folders);
  const src = resolveMediaUrl(item.url);

  const handleSave = () => {
    const folderId = folderValue === "root" ? null : Number(folderValue);
    onSave(item, title, folderId);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onReplaceFile(item, file);
    event.target.value = "";
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Επεξεργασία φωτογραφίας</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={item.title} className="h-full w-full object-cover" />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={replacing}
              onClick={() => replaceInputRef.current?.click()}
              className="gap-2"
            >
              <ImagePlus className="h-4 w-4" /> {replacing ? "Μεταφόρτωση..." : "Αλλαγή φωτογραφίας"}
            </Button>
            <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-photo-title">Όνομα/Τίτλος</Label>
            <Input id="edit-photo-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Φάκελος</Label>
            <Select value={folderValue} onValueChange={(value) => value && setFolderValue(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Όλα τα αρχεία (χωρίς φάκελο)</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Ακύρωση
          </Button>
          <Button type="button" onClick={handleSave} className="gap-2 bg-primary hover:bg-primary/90">
            <Save className="h-4 w-4" /> Αποθήκευση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MediaGalleryPage() {
  return (
    <ProtectedRoute allow="coach">
      <MediaGalleryContent />
    </ProtectedRoute>
  );
}
