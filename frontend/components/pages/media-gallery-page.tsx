"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

interface RawMediaItem {
  id: number | string;
  kind: "media_asset" | "exercise_image";
  title: string;
  url?: string;
  folderId?: number | string | null;
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

function MediaGalleryContent() {
  const { user, logout } = useAuth();
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [dragAssetId, setDragAssetId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null | "root">(null);

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(null);
  const [moveTargetIds, setMoveTargetIds] = useState<number[] | null>(null);

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

  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesFolder = selectedFolderId === null || asset.folderId === selectedFolderId;
      const matchesSearch = !search || asset.title.toLowerCase().includes(search.toLowerCase());
      return matchesFolder && matchesSearch;
    });
  }, [assets, selectedFolderId, search]);

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

  const toggleSelect = (id: number) => {
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

  const moveAssets = async (ids: number[], folderId: number | null) => {
    try {
      if (ids.length === 1) {
        await api.put(`/media/assets/${ids[0]}/folder`, { folderId });
      } else {
        await api.put("/media/assets/bulk-move", { ids, folderId });
      }
      setAssets((current) => current.map((asset) => (ids.includes(asset.id) ? { ...asset, folderId } : asset)));
      loadLibrary();
      const folderName = folderId ? folders.find((folder) => folder.id === folderId)?.name : "Όλα τα αρχεία";
      toast.success(`Μετακινήθηκε στον φάκελο ${folderName || ""}`.trim());
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε μετακίνηση."));
    }
  };

  const handleDropOnFolder = (folderId: number | null) => {
    setDropTarget(null);
    if (dragAssetId == null) return;
    const ids = selectMode && selectedIds.has(dragAssetId) ? Array.from(selectedIds) : [dragAssetId];
    setDragAssetId(null);
    moveAssets(ids, folderId);
  };

  const deleteAsset = async (id: number) => {
    try {
      await api.delete(`/media/media_asset/${id}`);
      setAssets((current) => current.filter((asset) => asset.id !== id));
      toast.success("Η φωτογραφία διαγράφηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Δεν έγινε διαγραφή."));
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const confirmed = window.confirm(`Να διαγραφούν ${ids.length} φωτογραφίες;`);
    if (!confirmed) return;
    await Promise.all(ids.map((id) => api.delete(`/media/media_asset/${id}`).catch(() => null)));
    setAssets((current) => current.filter((asset) => !ids.includes(asset.id)));
    toast.success(`${ids.length} φωτογραφίες διαγράφηκαν.`);
    clearSelection();
  };

  const uploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImageFile(file, { maxWidth: 1800, maxHeight: 1800, quality: 0.84 });
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("title", file.name.replace(/\.[^.]+$/, ""));
      formData.append("assetType", "photo");
      if (selectedFolderId !== null) formData.append("folderId", String(selectedFolderId));
      const created = await api.upload<{ id: number; title: string; url: string; folderId: number | null }>("/media/upload", formData);
      setAssets((current) => [{ id: created.id, title: created.title, url: created.url, folderId: created.folderId }, ...current]);
      if (selectedFolderId !== null) {
        setFolders((current) => current.map((folder) => (folder.id === selectedFolderId ? { ...folder, itemCount: folder.itemCount + 1 } : folder)));
      }
      toast.success("Η φωτογραφία ανέβηκε.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Το upload απέτυχε."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const moveDialogAssetCount = moveTargetIds?.length || 0;

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
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2 bg-red-600 font-medium hover:bg-red-700"
          >
            <Upload className="h-4 w-4" /> {uploading ? "Ανέβασμα..." : "Ανέβασμα"}
          </Button>
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
            dragActive={dragAssetId !== null}
            dropTargetId={dropTarget}
            onDropTargetChange={setDropTarget}
            onDropAsset={handleDropOnFolder}
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

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>
            ) : !visibleAssets.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <ImageOff className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <p className="font-semibold text-slate-500 dark:text-slate-400">Δεν βρέθηκαν φωτογραφίες.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visibleAssets.map((asset, index) => (
                  <GalleryCard
                    key={asset.id}
                    asset={asset}
                    selectMode={selectMode}
                    selected={selectedIds.has(asset.id)}
                    onToggleSelect={() => toggleSelect(asset.id)}
                    onPreview={() => setPreviewIndex(index)}
                    onMove={() => setMoveTargetIds([asset.id])}
                    onDelete={() => deleteAsset(asset.id)}
                    onDragStart={() => setDragAssetId(asset.id)}
                    onDragEnd={() => setDragAssetId(null)}
                  />
                ))}
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg dark:bg-slate-800">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{selectedIds.size} εικόνες επιλεγμένες</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMoveTargetIds(Array.from(selectedIds))} className="gap-2 text-white hover:bg-white/10 hover:text-white">
              <FolderInput className="h-4 w-4" /> Μετακίνηση
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={bulkDelete} className="gap-2 text-red-300 hover:bg-white/10 hover:text-red-200">
              <Trash2 className="h-4 w-4" /> Διαγραφή
            </Button>
          </div>
        </div>
      )}

      <PreviewDialog assets={visibleAssets} index={previewIndex} onClose={() => setPreviewIndex(null)} onNavigate={setPreviewIndex} />

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

      <Dialog open={moveTargetIds !== null} onOpenChange={(open) => !open && setMoveTargetIds(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Μετακίνηση σε...</DialogTitle>
            <DialogDescription>{moveDialogAssetCount} {moveDialogAssetCount === 1 ? "εικόνα" : "εικόνες"}</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            <MediaFolderTree
              folders={folders}
              selectedFolderId={null}
              onSelect={(folderId) => {
                if (moveTargetIds) moveAssets(moveTargetIds, folderId);
                setMoveTargetIds(null);
              }}
              onCreate={createFolder}
              onRename={renameFolder}
              onDelete={setDeleteFolderTarget}
              dragActive={false}
              dropTargetId={null}
              onDropTargetChange={() => {}}
              onDropAsset={() => {}}
            />
          </div>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

function GalleryCard({
  asset,
  selectMode,
  selected,
  onToggleSelect,
  onPreview,
  onMove,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  asset: MediaAssetItem;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onMove: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const src = resolveMediaUrl(asset.url);
  const [failed, setFailed] = useState(false);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Card
            draggable={!selectMode}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className={cn("group relative overflow-hidden p-0", !selectMode && "cursor-grab active:cursor-grabbing", selected && "ring-2 ring-red-500")}
          />
        }
      >
        {selectMode && (
          <div className="absolute left-2 top-2 z-10">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="bg-white" />
          </div>
        )}

        <button type="button" onClick={selectMode ? onToggleSelect : onPreview} className="relative block aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {!src || failed ? (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={asset.title} onError={() => setFailed(true)} loading="lazy" className="h-full w-full object-cover" />
          )}
          {!selectMode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
              <span className="pointer-events-auto rounded-full bg-white/95 p-2 text-slate-900 shadow" onClick={(event) => { event.stopPropagation(); onPreview(); }}>
                <Eye className="h-4 w-4" />
              </span>
            </div>
          )}
        </button>
        <div className="truncate px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">{asset.title}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onPreview}>
          <Eye className="h-4 w-4" /> Προεπισκόπηση
        </ContextMenuItem>
        <ContextMenuItem onClick={onMove}>
          <FolderInput className="h-4 w-4" /> Μετακίνηση σε...
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
  assets,
  index,
  onClose,
  onNavigate,
}: {
  assets: MediaAssetItem[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const open = index !== null;
  const asset = index !== null ? assets[index] : null;

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index !== null && index > 0) onNavigate(index - 1);
      if (event.key === "ArrowRight" && index !== null && index < assets.length - 1) onNavigate(index + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, assets.length]);

  if (!asset || index === null) return null;
  const src = resolveMediaUrl(asset.url);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] w-full max-w-4xl overflow-hidden bg-black/95 p-0 sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{asset.title}</DialogTitle>
          <DialogDescription>Προεπισκόπηση φωτογραφίας</DialogDescription>
        </DialogHeader>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="h-5 w-5 text-white" />
        </button>
        <div className="relative flex h-[80vh] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={asset.title} className="max-h-full max-w-full object-contain" />
          {index > 0 && (
            <button type="button" onClick={() => onNavigate(index - 1)} aria-label="Previous" className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
          )}
          {index < assets.length - 1 && (
            <button type="button" onClick={() => onNavigate(index + 1)} aria-label="Next" className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 bg-black/60 px-4 py-3 text-white">
          <span className="truncate text-sm font-medium">{asset.title}</span>
          <Badge variant="secondary">{index + 1} / {assets.length}</Badge>
        </div>
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
