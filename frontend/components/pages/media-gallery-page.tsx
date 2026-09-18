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
import { MediaFolderTree, type MediaFolder, type MediaCategory } from "@/components/shared/media-folder-tree";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { compressImageFile } from "@/lib/image-compression";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface RawMediaItem {
  id: number | string;
  kind: "media_asset" | "exercise_image";
  title: string;
  url?: string;
  folderId?: number | string | null;
}

// Unified shape for anything the grid can render, whether it's a custom
// media_assets upload or a centralized exercise/food/progress-photo item.
interface GalleryItem {
  id: string; // unique within the current view: "asset-5" or "exercise-1901"
  entityId: number;
  title: string;
  url: string;
  folderId: number | null;
  kind: "asset" | "category";
  category?: MediaCategory;
  parentId?: number; // exercise id, only present for kind="category" && category="exercise"
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

function resolveCategoryContext(folders: MediaFolder[], folderId: number | null): { category: MediaCategory; rootId: number } | null {
  if (folderId === null) return null;
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let current = byId.get(folderId);
  while (current) {
    if (current.category) return { category: current.category, rootId: current.id };
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}

function categoryOfFolder(folders: MediaFolder[], folderId: number | null): MediaCategory | null {
  if (folderId === null) return null;
  return resolveCategoryContext(folders, folderId)?.category ?? null;
}

// Folders to offer as move destinations: only the same category's subtree for
// category items, or only non-category folders for custom uploads.
function foldersForMoveTarget(folders: MediaFolder[], category: MediaCategory | null): MediaFolder[] {
  if (!category) {
    return folders.filter((folder) => categoryOfFolder(folders, folder.id) === null);
  }
  return folders.filter((folder) => categoryOfFolder(folders, folder.id) === category);
}

// Flattens a category/custom folder subtree into a depth-indented list for
// use as <Select> options — the same scoping foldersForMoveTarget uses, just
// walked in tree order instead of left as a flat unordered array.
function flattenFolderOptions(folders: MediaFolder[], category: MediaCategory | null): Array<{ id: number; label: string }> {
  const scoped = foldersForMoveTarget(folders, category);
  const byParent = new Map<number | null, MediaFolder[]>();
  scoped.forEach((folder) => {
    const list = byParent.get(folder.parentId) ?? [];
    list.push(folder);
    byParent.set(folder.parentId, list);
  });
  const result: Array<{ id: number; label: string }> = [];
  const walk = (parentId: number | null, depth: number) => {
    const children = (byParent.get(parentId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "el"));
    children.forEach((folder) => {
      result.push({ id: folder.id, label: `${"— ".repeat(depth)}${folder.name}` });
      walk(folder.id, depth + 1);
    });
  };
  walk(null, 0);
  return result;
}

function deletePathFor(item: GalleryItem): string {
  if (item.kind === "asset") return `/media/media_asset/${item.entityId}`;
  if (item.category === "exercise") return `/exercises/${item.parentId}/images/${item.entityId}`;
  if (item.category === "food") return `/media/foods/${item.entityId}/image`;
  return `/progress/photos/${item.entityId}`;
}

// Each entity type stores its file through a different owning route (and a
// different multer field name) — mirrors deletePathFor's per-kind routing.
function replaceEndpointFor(item: GalleryItem): { path: string; field: string } {
  if (item.kind === "asset") return { path: `/media/assets/${item.entityId}/file`, field: "file" };
  if (item.category === "exercise") return { path: `/exercises/${item.parentId}/images/${item.entityId}/file`, field: "image" };
  if (item.category === "food") return { path: `/media/foods/${item.entityId}/image`, field: "image" };
  return { path: `/progress/photos/${item.entityId}/file`, field: "photo" };
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(null);
  const [moveTargetItems, setMoveTargetItems] = useState<GalleryItem[] | null>(null);
  const [editTarget, setEditTarget] = useState<GalleryItem | null>(null);
  const [replacingFile, setReplacingFile] = useState(false);

  const [categoryItems, setCategoryItems] = useState<GalleryItem[]>([]);
  const [categoryTotal, setCategoryTotal] = useState(0);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Client-side load-more window for the custom "Όλα τα αρχεία" view, which
  // (unlike the category views) has no server-side pagination — every asset
  // is already loaded, we just reveal it in pages of PAGE_SIZE.
  const [assetVisibleCount, setAssetVisibleCount] = useState(PAGE_SIZE);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryContext = useMemo(() => resolveCategoryContext(folders, selectedFolderId), [folders, selectedFolderId]);

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

  const fetchCategoryPage = (category: MediaCategory, folderId: number, page: number, replace: boolean) => {
    setCategoryLoading(true);
    const params = new URLSearchParams({ folderId: String(folderId), page: String(page), limit: String(PAGE_SIZE) });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    api
      .get<{ items: GalleryItem[]; total: number; page: number }>(`/media/categories/${category}?${params.toString()}`)
      .then((response) => {
        const mapped = response.items.map((item) => ({ ...item, id: `${category}-${item.entityId}`, kind: "category" as const }));
        setCategoryItems((current) => (replace ? mapped : [...current, ...mapped]));
        setCategoryTotal(response.total);
        setCategoryPage(response.page);
      })
      .catch(() => {
        if (replace) setCategoryItems([]);
      })
      .finally(() => setCategoryLoading(false));
  };

  useEffect(() => {
    if (!categoryContext) {
      setCategoryItems([]);
      setCategoryTotal(0);
      return;
    }
    fetchCategoryPage(categoryContext.category, selectedFolderId as number, 1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryContext?.category, selectedFolderId, debouncedSearch]);

  const filteredAssetItems: GalleryItem[] = useMemo(() => {
    if (categoryContext) return [];
    return assets
      .filter((asset) => {
        const matchesFolder = selectedFolderId === null || asset.folderId === selectedFolderId;
        const matchesSearch = !debouncedSearch || asset.title.toLowerCase().includes(debouncedSearch.toLowerCase());
        return matchesFolder && matchesSearch;
      })
      .map((asset) => ({ id: `asset-${asset.id}`, entityId: asset.id, title: asset.title, url: asset.url, folderId: asset.folderId, kind: "asset" as const }));
  }, [categoryContext, assets, selectedFolderId, debouncedSearch]);

  // Reset the reveal window whenever the underlying filtered set changes, so
  // switching folders/searching doesn't leave a stale "load more" position.
  useEffect(() => {
    setAssetVisibleCount(PAGE_SIZE);
  }, [selectedFolderId, debouncedSearch]);

  const displayItems: GalleryItem[] = useMemo(() => {
    if (categoryContext) return categoryItems;
    return filteredAssetItems.slice(0, assetVisibleCount);
  }, [categoryContext, categoryItems, filteredAssetItems, assetVisibleCount]);

  const canLoadMoreAssets = !categoryContext && assetVisibleCount < filteredAssetItems.length;

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

  const refreshAfterMove = (movedCategory: MediaCategory | null, folderId: number) => {
    if (movedCategory && categoryContext) {
      fetchCategoryPage(movedCategory, selectedFolderId as number, 1, true);
    }
    loadLibrary();
    const folderName = folderId ? folders.find((folder) => folder.id === folderId)?.name : "Όλα τα αρχεία";
    toast.success(`Μετακινήθηκε στον φάκελο ${folderName || ""} ✅`.trim());
  };

  const moveItems = async (items: GalleryItem[], folderId: number) => {
    if (!items.length) return;
    const category = items[0].category ?? null;
    const targetCategory = categoryOfFolder(folders, folderId);
    if (targetCategory !== category) {
      toast.error("Δεν μπορείς να μετακινήσεις εικόνες εκτός της κατηγορίας τους.");
      return;
    }

    try {
      if (category) {
        const entityIds = items.map((item) => item.entityId);
        if (entityIds.length === 1) {
          await api.put(`/media/categories/${category}/${entityIds[0]}/folder`, { folderId });
        } else {
          await api.put(`/media/categories/${category}/bulk-move`, { entityIds, folderId });
        }
      } else {
        const assetIds = items.map((item) => item.entityId);
        if (assetIds.length === 1) {
          await api.put(`/media/assets/${assetIds[0]}/folder`, { folderId });
        } else {
          await api.put("/media/assets/bulk-move", { ids: assetIds, folderId });
        }
        setAssets((current) => current.map((asset) => (assetIds.includes(asset.id) ? { ...asset, folderId } : asset)));
      }
      refreshAfterMove(category, folderId);
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε μετακίνηση."));
    }
  };

  const saveEdit = async (item: GalleryItem, title: string, folderId: number | null) => {
    const trimmedTitle = title.trim();
    const titleChanged = item.kind === "asset" && trimmedTitle && trimmedTitle !== item.title;
    const folderChanged = folderId !== item.folderId;

    try {
      if (titleChanged) {
        await api.put(`/media/media_asset/${item.entityId}`, { title: trimmedTitle });
      }
      if (folderChanged) {
        if (item.category) {
          if (folderId === null) throw new Error("Category items must stay inside their category.");
          await api.put(`/media/categories/${item.category}/${item.entityId}/folder`, { folderId });
        } else {
          await api.put(`/media/assets/${item.entityId}/folder`, { folderId });
        }
      }

      if (item.kind === "asset") {
        setAssets((current) =>
          current.map((asset) =>
            asset.id === item.entityId
              ? { ...asset, title: titleChanged ? trimmedTitle : asset.title, folderId: folderChanged ? folderId : asset.folderId }
              : asset,
          ),
        );
      }
      if (categoryContext) {
        fetchCategoryPage(categoryContext.category, selectedFolderId as number, 1, true);
      }
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
      if (categoryContext) {
        fetchCategoryPage(categoryContext.category, selectedFolderId as number, 1, true);
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
      if (item.kind === "asset") {
        setAssets((current) => current.filter((asset) => asset.id !== item.entityId));
      } else if (categoryContext) {
        fetchCategoryPage(categoryContext.category, selectedFolderId as number, 1, true);
      }
      loadLibrary();
      toast.success("Η φωτογραφία διαγράφηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε διαγραφή."));
    }
  };

  const bulkDelete = async () => {
    const items = displayItems.filter((item) => selectedIds.has(item.id));
    if (!items.length) return;
    const confirmed = window.confirm(`Να διαγραφούν ${items.length} φωτογραφίες;`);
    if (!confirmed) return;
    await Promise.all(items.map((item) => api.delete(deletePathFor(item)).catch(() => null)));
    if (categoryContext) {
      fetchCategoryPage(categoryContext.category, selectedFolderId as number, 1, true);
    } else {
      const removedIds = new Set(items.map((item) => item.entityId));
      setAssets((current) => current.filter((asset) => !removedIds.has(asset.id)));
    }
    loadLibrary();
    toast.success(`${items.length} φωτογραφίες διαγράφηκαν.`);
    clearSelection();
  };

  const uploadFilesToFolder = async (files: File[], folderId: number | null) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    if (categoryOfFolder(folders, folderId) !== null) {
      toast.error("Δεν μπορείς να ανεβάσεις φωτογραφίες εδώ — αυτός ο φάκελος συγκεντρώνει εικόνες αυτόματα.");
      return;
    }

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
    if (categoryContext) return;
    if (event.dataTransfer.files.length) uploadFilesToFolder(Array.from(event.dataTransfer.files), selectedFolderId);
  };

  const moveDialogCategory = moveTargetItems?.[0]?.category ?? null;
  const moveDialogFolders = useMemo(() => foldersForMoveTarget(folders, moveDialogCategory), [folders, moveDialogCategory]);
  const canLoadMoreCategory = categoryContext ? categoryItems.length < categoryTotal : false;

  return (
    <CoachShell title="Media Library" user={user} logout={logout}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-slate-50">Media Library</h1>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <Button type="button" variant="outline" size="sm" onClick={clearSelection} className="font-medium">
              Ακύρωση επιλογής
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectMode(true)} className="gap-2 font-medium">
              <CheckSquare className="h-4 w-4" /> Επιλογή πολλαπλών
            </Button>
          )}
          {!categoryContext && (
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2 bg-red-600 font-medium hover:bg-red-700"
            >
              <Upload className="h-4 w-4" /> {uploading ? "Ανέβασμα..." : "Ανέβασμα"}
            </Button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadFile} className="hidden" />
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="mt-5 min-h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800">
        <ResizablePanel defaultSize="22" minSize="16" maxSize="35" className="flex flex-col overflow-hidden">
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
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
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

            <div className="flex h-10 w-full max-w-sm items-center rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
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
              if (!categoryContext && event.dataTransfer?.types?.includes("Files")) event.preventDefault();
            }}
            onDragEnter={(event) => {
              if (!categoryContext && event.dataTransfer?.types?.includes("Files")) setContentDropActive(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setContentDropActive(false);
            }}
            onDrop={handleContentDrop}
            className={cn("relative flex-1 overflow-y-auto p-4", contentDropActive && "bg-red-50/60 dark:bg-red-500/5")}
          >
            {contentDropActive && (
              <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-red-400 bg-white/70 text-sm font-semibold text-red-600 dark:bg-slate-950/70">
                Άσε το αρχείο εδώ για ανέβασμα
              </div>
            )}
            {loading || (categoryContext && categoryLoading && !categoryItems.length) ? (
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>
            ) : !displayItems.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <ImageOff className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <p className="font-semibold text-slate-500 dark:text-slate-400">Δεν βρέθηκαν φωτογραφίες.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {displayItems.map((item, index) => (
                    <GalleryCard
                      key={item.id}
                      item={item}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onPreview={() => setPreviewIndex(index)}
                      onMove={() => setMoveTargetItems([item])}
                      onDelete={() => deleteItem(item)}
                      onEdit={() => setEditTarget(item)}
                    />
                  ))}
                </div>
                {canLoadMoreCategory && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => categoryContext && fetchCategoryPage(categoryContext.category, selectedFolderId as number, categoryPage + 1, false)}
                    disabled={categoryLoading}
                    className="mt-4 w-full font-medium text-slate-500 hover:text-red-600 dark:text-slate-400"
                  >
                    {categoryLoading ? "Φόρτωση..." : `Εμφάνιση περισσότερων (${categoryTotal - categoryItems.length} ακόμα)`}
                  </Button>
                )}
                {canLoadMoreAssets && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAssetVisibleCount((current) => current + PAGE_SIZE)}
                    className="mt-4 w-full font-medium text-slate-500 hover:text-red-600 dark:text-slate-400"
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
  selectMode,
  selected,
  onToggleSelect,
  onPreview,
  onMove,
  onDelete,
  onEdit,
}: {
  item: GalleryItem;
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

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<Card className={cn("group relative overflow-hidden p-0", selected && "ring-2 ring-red-500")} />}
      >
        {selectMode && (
          <div className="absolute left-2 top-2 z-10">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="bg-white" />
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={selectMode ? onToggleSelect : onPreview}
          onKeyDown={(event) => { if (event.key === "Enter") (selectMode ? onToggleSelect : onPreview)(); }}
          className="relative block aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
        >
          {!src || failed ? (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={item.title} onError={() => setFailed(true)} loading="lazy" className="h-full w-full object-cover" />
          )}
          {!selectMode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
              <button type="button" className="pointer-events-auto rounded-full bg-white/95 p-2 text-slate-900 shadow" onClick={(event) => { event.stopPropagation(); onPreview(); }}>
                <Eye className="h-4 w-4" />
              </button>
            </div>
          )}
          {!selectMode && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onEdit(); }}
              className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1.5 bg-black/70 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" /> Επεξεργασία
            </button>
          )}
        </div>
        <div className="truncate px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">{item.title}</div>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={item.title} className="max-h-full max-w-full object-contain" />
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
  const isCustom = item.kind === "asset";
  const options = flattenFolderOptions(folders, item.category ?? null);
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
          {isCustom ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-photo-title">Όνομα/Τίτλος</Label>
              <Input id="edit-photo-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
          ) : (
            <p className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">{item.title}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Φάκελος</Label>
            <Select value={folderValue} onValueChange={(value) => value && setFolderValue(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isCustom && <SelectItem value="root">Όλα τα αρχεία (χωρίς φάκελο)</SelectItem>}
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
          <Button type="button" onClick={handleSave} className="gap-2 bg-red-600 hover:bg-red-700">
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
