"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Upload, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CoachShell } from "@/components/shell/coach-shell";
import PaginationControls from "@/components/shared/pagination-controls";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { compressImageFile } from "@/lib/image-compression";
import { resolveMediaUrl } from "@/lib/media";

interface MediaFolder {
  id: string | number;
  name: string;
  source: "custom" | "exercise";
}

interface MediaAsset {
  id: string | number;
  kind: "media_asset" | "exercise_image";
  title: string;
  url?: string;
  folderId?: string | number | null;
  folderName?: string | null;
  source?: string;
}

interface EditForm {
  title: string;
  url: string;
  folderId: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaLibraryContent() {
  const { user, logout } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [search, setSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: "", url: "", folderId: "" });
  const [renamingFolder, setRenamingFolder] = useState<MediaFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragAsset, setDragAsset] = useState<MediaAsset | null>(null);
  const [dropTarget, setDropTarget] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const loadLibrary = () => {
    Promise.all([api.get<MediaAsset[]>("/media"), api.get<MediaFolder[]>("/media/folders")])
      .then(([media, folderRows]) => {
        setAssets(media);
        setFolders(folderRows);
      })
      .catch(() => {
        setAssets([]);
        setFolders([]);
      });
  };

  useEffect(() => {
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const folderCounts = useMemo(() => {
    return assets.reduce<Record<string, number>>((counts, asset) => {
      const key = String(asset.folderId || "uncategorized");
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [assets]);

  const filteredAssets = assets.filter((asset) => {
    const title = asset.title || "";
    const matchesSearch = !search || title.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = !selectedFolder || String(asset.folderId || "uncategorized") === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedFolder]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredAssets.length, pageSize]);

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [currentPage, filteredAssets, pageSize]);

  const customFolders = folders.filter((folder) => folder.source === "custom");
  const exerciseFolders = folders.filter((folder) => folder.source === "exercise");
  const allFolders = [...customFolders, ...exerciseFolders];

  const changePageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post("/media/folders", { name: newFolderName.trim() });
      setNewFolderName("");
      setMessage("Ο φάκελος δημιουργήθηκε.");
      loadLibrary();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Δεν δημιουργήθηκε ο φάκελος.");
    }
  };

  const openRenameFolder = (folder: MediaFolder) => {
    if (folder.source !== "custom") return;
    setRenamingFolder(folder);
    setRenameValue(folder.name);
  };

  const saveRenameFolder = async () => {
    if (!renamingFolder || !renameValue.trim()) return;
    try {
      await api.put(`/media/folders/${renamingFolder.id}`, { name: renameValue.trim() });
      setRenamingFolder(null);
      setRenameValue("");
      setMessage("Ο φάκελος μετονομάστηκε.");
      loadLibrary();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Δεν έγινε μετονομασία φακέλου.");
    }
  };

  const deleteFolder = async (folder: MediaFolder) => {
    if (folder.source !== "custom") return;
    const confirmed = window.confirm(`Να διαγραφεί ο φάκελος "${folder.name}"; Τα media θα μείνουν χωρίς φάκελο.`);
    if (!confirmed) return;

    try {
      await api.delete(`/media/folders/${folder.id}`);
      if (selectedFolder === String(folder.id)) setSelectedFolder("");
      setMessage("Ο φάκελος διαγράφηκε.");
      loadLibrary();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Δεν έγινε διαγραφή φακέλου.");
    }
  };

  const moveAssetToFolder = async (asset: MediaAsset | null, folderId: string) => {
    if (!asset) return;
    if (asset.kind !== "media_asset") {
      setMessage(
        "Οι φωτογραφίες που είναι δεμένες απευθείας σε άσκηση δεν μετακινούνται. Ανέβασε ή αρχειοθέτησε την εικόνα ως media asset.",
      );
      return;
    }

    try {
      await api.put(`/media/${asset.kind}/${asset.id}`, {
        title: asset.title,
        url: asset.url,
        folderId: folderId === "uncategorized" ? "" : folderId,
      });
      setAssets((items) =>
        items.map((item) => {
          if (item.kind !== asset.kind || item.id !== asset.id) return item;
          const folder = customFolders.find((row) => String(row.id) === String(folderId));
          return {
            ...item,
            folderId: folderId === "uncategorized" ? null : folderId,
            folderName: folderId === "uncategorized" ? null : folder?.name || item.folderName,
          };
        }),
      );
      setMessage("Η φωτογραφία μετακινήθηκε.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Δεν έγινε μετακίνηση φωτογραφίας.");
    }
  };

  const handleFolderDrop = async (event: DragEvent<HTMLDivElement>, folderId: string) => {
    event.preventDefault();
    await moveAssetToFolder(dragAsset, folderId);
    setDragAsset(null);
    setDropTarget("");
  };

  const uploadAsset = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("Συμπίεση και ανέβασμα media...");
    const compressedFile = await compressImageFile(file, { maxWidth: 1800, maxHeight: 1800, quality: 0.84 });
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("title", file.name.replace(/\.[^.]+$/, ""));
    formData.append("assetType", file.type.includes("svg") ? "icon" : "photo");
    if (selectedFolder && !selectedFolder.startsWith("muscle-") && selectedFolder !== "uncategorized") {
      formData.append("folderId", selectedFolder);
    }

    try {
      await api.upload("/media/upload", formData);
      setMessage(`Το media αποθηκεύτηκε. ${formatBytes(file.size)} -> ${formatBytes(compressedFile.size)}`);
      loadLibrary();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Το upload απέτυχε.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const openEdit = (asset: MediaAsset) => {
    setEditing(asset);
    setEditForm({
      title: asset.title,
      url: asset.url || "",
      folderId: asset.kind === "media_asset" ? String(asset.folderId || "") : "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.put(`/media/${editing.kind}/${editing.id}`, editForm);
      setEditing(null);
      setMessage("Το media ενημερώθηκε στη βάση.");
      loadLibrary();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Δεν έγινε αποθήκευση.");
    }
  };

  const deleteAsset = async (asset: MediaAsset) => {
    try {
      await api.delete(`/media/${asset.kind}/${asset.id}`);
      setMessage(asset.kind === "exercise_image" ? "Η φωτογραφία αφαιρέθηκε από την άσκηση." : "Το media διαγράφηκε.");
      loadLibrary();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Δεν έγινε διαγραφή.");
    }
  };

  return (
    <CoachShell title="Media Library" user={user} logout={logout}>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="font-semibold text-blue-600">
              Dashboard
            </Link>
            <span className="text-slate-400 dark:text-slate-500">›</span>
            <span className="text-slate-600 dark:text-slate-400">Media Library</span>
          </div>
          <h2 className="mt-5 text-3xl font-extrabold">Φωτογραφίες &amp; Εικονίδια</h2>
        </div>
        <label
          className={`flex h-12 cursor-pointer items-center gap-3 rounded-md px-6 font-bold text-white shadow-lg shadow-red-200 ${uploading ? "bg-slate-400" : "bg-red-600 hover:bg-red-700"}`}
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload Media"}
          <input type="file" accept="image/*" onChange={uploadAsset} className="hidden" />
        </label>
      </div>

      {message && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {message}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-extrabold dark:text-slate-50">Φάκελοι</h3>
          <div className="mt-4 flex gap-2">
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Νέος φάκελος"
              className="h-10 min-w-0 flex-1 focus-visible:border-red-300"
            />
            <Button onClick={createFolder} className="h-10 bg-red-600 px-3 text-sm font-bold hover:bg-red-700">
              Add
            </Button>
          </div>
          <FolderButton label="Όλα τα media" active={!selectedFolder} count={assets.length} onClick={() => setSelectedFolder("")} />
          <FolderButton
            label="Χωρίς φάκελο"
            active={selectedFolder === "uncategorized"}
            count={folderCounts.uncategorized || 0}
            onClick={() => setSelectedFolder("uncategorized")}
            canDrop={Boolean(dragAsset)}
            isDropTarget={dropTarget === "uncategorized"}
            onDragEnter={() => setDropTarget("uncategorized")}
            onDragLeave={() => setDropTarget("")}
            onDrop={(event) => handleFolderDrop(event, "uncategorized")}
          />

          <div className="mt-5 text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400">Custom Folders</div>
          <div className="max-h-[420px] overflow-y-auto pr-1">
            {allFolders.map((folder) => (
              <FolderButton
                key={folder.id}
                label={folder.name}
                active={selectedFolder === String(folder.id)}
                count={folderCounts[String(folder.id)] || 0}
                canManage={folder.source === "custom"}
                canDrop={folder.source === "custom" && Boolean(dragAsset)}
                isDropTarget={dropTarget === String(folder.id)}
                onClick={() => setSelectedFolder(String(folder.id))}
                onRename={() => openRenameFolder(folder)}
                onDelete={() => deleteFolder(folder)}
                onDragEnter={() => setDropTarget(String(folder.id))}
                onDragLeave={() => setDropTarget("")}
                onDrop={(event) => handleFolderDrop(event, String(folder.id))}
              />
            ))}
          </div>
        </section>

        <section className="col-span-9">
          <div className="grid grid-cols-12 gap-5">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Αναζήτηση media..."
              className="col-span-11 h-14 focus-visible:border-red-300"
            />
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setSelectedFolder("");
              }}
              className="col-span-1 h-14 font-bold hover:border-red-200 hover:text-red-600"
            >
              Reset
            </Button>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <PaginationControls
              totalItems={filteredAssets.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageSizeChange={changePageSize}
              onPageChange={setCurrentPage}
              itemLabel="media"
              variant="summary"
            />
          </div>

          <div className="mt-7 grid grid-cols-3 gap-5">
            {paginatedAssets.map((asset) => (
              <Card
                key={`${asset.kind}-${asset.id}`}
                draggable={asset.kind === "media_asset"}
                onDragStart={(event) => {
                  setDragAsset(asset);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragAsset(null);
                  setDropTarget("");
                }}
                className={asset.kind === "media_asset" ? "cursor-grab active:cursor-grabbing" : ""}
              >
                <div className="h-44 bg-slate-100 dark:bg-slate-800">
                  <MediaPreview asset={asset} />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold">{asset.title}</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{asset.folderName || asset.source}</p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{asset.kind}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={() => openEdit(asset)} className="h-10 font-bold hover:border-red-200 hover:text-red-600">
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => deleteAsset(asset)}
                      className="h-10 border-red-200 font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {!filteredAssets.length && (
            <div className="mt-10 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Δεν βρέθηκαν media.
            </div>
          )}
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <PaginationControls
              totalItems={filteredAssets.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageSizeChange={changePageSize}
              onPageChange={setCurrentPage}
              itemLabel="media"
              variant="pages"
            />
          </div>
        </section>
      </div>

      <Dialog open={Boolean(renamingFolder)} onOpenChange={(open) => !open && setRenamingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Όνομα φακέλου</Label>
              <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="focus-visible:border-red-300" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingFolder(null)} className="font-bold hover:border-red-200 hover:text-red-600">
              Άκυρο
            </Button>
            <Button onClick={saveRenameFolder} className="bg-red-600 font-bold hover:bg-red-700">
              Αποθήκευση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Media</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Τίτλος</Label>
              <Input
                value={editForm.title}
                onChange={(event) => setEditForm((form) => ({ ...form, title: event.target.value }))}
                className="focus-visible:border-red-300"
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={editForm.url}
                onChange={(event) => setEditForm((form) => ({ ...form, url: event.target.value }))}
                className="focus-visible:border-red-300"
              />
            </div>
            {editing?.kind === "media_asset" && (
              <div className="space-y-2">
                <Label>Φάκελος</Label>
                <Select
                  value={editForm.folderId || "none"}
                  onValueChange={(value) => setEditForm((form) => ({ ...form, folderId: !value || value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Χωρίς φάκελο</SelectItem>
                    {customFolders.map((folder) => (
                      <SelectItem key={folder.id} value={String(folder.id)}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={saveEdit} className="bg-red-600 font-bold hover:bg-red-700">
              Αποθήκευση
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

function FolderButton({
  label,
  active,
  count,
  onClick,
  canManage = false,
  canDrop = false,
  isDropTarget = false,
  onRename,
  onDelete,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
  canManage?: boolean;
  canDrop?: boolean;
  isDropTarget?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
      }}
      onDragEnter={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onDragEnter?.();
      }}
      onDragLeave={() => {
        if (canDrop) onDragLeave?.();
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        onDrop?.(event);
      }}
      className={`mt-2 flex w-full items-center rounded-md text-sm font-semibold ${active ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"} ${isDropTarget ? "ring-2 ring-red-300" : ""}`}
    >
      <Button variant="ghost" onClick={onClick} className="h-auto min-w-0 flex-1 justify-between px-3 py-2 text-left font-semibold">
        <span className="truncate">{label}</span>
        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{count}</span>
      </Button>
      {canManage && (
        <div className="mr-2 flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              onRename?.();
            }}
            className="h-7 w-7 text-slate-600 hover:text-red-600 dark:text-slate-300"
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.();
            }}
            className="h-7 w-7 text-red-600 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MediaPreview({ asset }: { asset: MediaAsset }) {
  const src = resolveMediaUrl(asset.url);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="grid h-full place-items-center bg-slate-900 p-4 text-center text-sm font-extrabold uppercase text-white">
        {asset.title}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={asset.title}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
      width={400}
      height={176}
      unoptimized
    />
  );
}

export default function MediaLibraryPage() {
  return (
    <ProtectedRoute>
      <MediaLibraryContent />
    </ProtectedRoute>
  );
}
