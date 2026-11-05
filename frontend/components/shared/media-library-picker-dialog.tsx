"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, ImageOff, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MediaFolderTree, type MediaFolder } from "@/components/shared/media-folder-tree";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface RawMediaItem {
  id: number | string;
  kind: string;
  title: string;
  url?: string;
  assetType?: string;
  folderId?: number | string | null;
}

interface PhotoAsset {
  id: number;
  title: string;
  url: string;
  folderId: number | null;
}

function isPdf(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url);
}

// A payment-proof document can end up registered with assetType "photo" even
// when it's a PDF (see backend registerPaymentProofs) — the extension check
// is what actually guarantees "images only", the assetType filter alone isn't enough.
function isPickablePhoto(item: RawMediaItem): item is RawMediaItem & { url: string } {
  return item.kind === "media_asset" && Boolean(item.url) && item.assetType === "photo" && !isPdf(item.url as string);
}

export function MediaLibraryPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Επιλογή από Media Library",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  title?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [assets, setAssets] = useState<PhotoAsset[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [foldersVisible, setFoldersVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([api.get<RawMediaItem[]>("/media"), api.get<MediaFolder[]>("/media/folders")])
      .then(([media, folderRows]) => {
        setAssets(
          media.filter(isPickablePhoto).map((item) => ({
            id: Number(item.id),
            title: item.title,
            url: item.url,
            folderId: item.folderId === null || item.folderId === undefined || item.folderId === "" ? null : Number(item.folderId),
          }))
        );
        setFolders(folderRows);
      })
      .catch(() => {
        setAssets([]);
        setFolders([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedFolderId(null);
      setFoldersVisible(false);
    }
  }, [open]);

  const createFolder = async (name: string, parentId: number | null) => {
    const created = await api.post<MediaFolder>("/media/folders", { name, parentId });
    setFolders((current) => [...current, { ...created, itemCount: 0 }]);
  };

  const renameFolder = async (id: number, name: string) => {
    await api.put(`/media/folders/${id}`, { name });
    setFolders((current) => current.map((folder) => (folder.id === id ? { ...folder, name } : folder)));
  };

  const deleteFolder = async (folder: MediaFolder) => {
    if (!window.confirm(`Διαγραφή του φακέλου "${folder.name}";`)) return;
    await api.delete(`/media/folders/${folder.id}`);
    setFolders((current) => current.filter((item) => item.id !== folder.id));
    if (selectedFolderId === folder.id) setSelectedFolderId(folder.parentId);
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesFolder = selectedFolderId === null || asset.folderId === selectedFolderId;
      const matchesSearch = !debouncedSearch || asset.title.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesFolder && matchesSearch;
    });
  }, [assets, selectedFolderId, debouncedSearch]);

  // Δεν γίνεται render ούτε το portal του Dialog μέχρι να πατηθεί ρητά το κουμπί επιλογής εικόνας.
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-card p-0 shadow-none sm:max-w-none">
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0"><DialogTitle className="text-[18px] font-extrabold sm:text-[20px]">{title}</DialogTitle><DialogDescription className="mt-1 text-xs sm:text-sm">Μόνο φωτογραφίες εμφανίζονται εδώ — άλλα αρχεία (π.χ. PDF) αποκλείονται.</DialogDescription></div>
          <button type="button" onClick={() => setFoldersVisible((visible) => !visible)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-[12px] font-extrabold text-foreground hover:bg-muted" aria-expanded={foldersVisible}>
            {foldersVisible ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}<span className="hidden sm:inline">Φάκελοι</span><FolderOpen className="size-4 sm:hidden" />
          </button>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className={cn("shrink-0 overflow-y-auto border-border bg-muted/20", foldersVisible ? "max-h-52 w-full border-b sm:max-h-none sm:w-64 sm:border-b-0 sm:border-r" : "hidden")}>
            <MediaFolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onCreate={(name, parentId) => void createFolder(name, parentId)}
              onRename={(id, name) => void renameFolder(id, name)}
              onDelete={(folder) => void deleteFolder(folder)}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border p-3 sm:p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Αναζήτηση φωτογραφίας..." className="pl-9" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              {loading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Φόρτωση...</p>
              ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
                  <ImageOff className="h-8 w-8" />
                  <p>Δεν βρέθηκαν φωτογραφίες.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        onSelect(asset.url);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-[14px] border border-border bg-muted/30 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-sm",
                      )}
                      title={asset.title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveMediaUrl(asset.url)} alt={asset.title} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
