"use client";

import { useState, type DragEvent, type KeyboardEvent } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Pencil, Trash2, FolderPlus, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface MediaFolder {
  id: number;
  name: string;
  parentId: number | null;
  itemCount: number;
}

interface TreeNode extends MediaFolder {
  children: TreeNode[];
}

function buildTree(folders: MediaFolder[]): TreeNode[] {
  const byId = new Map<number, TreeNode>(folders.map((folder) => [folder.id, { ...folder, children: [] }]));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "el"));
    nodes.forEach((node) => sortRec(node.children));
  };
  sortRec(roots);
  return roots;
}

// A drag carrying real OS files (dragged in from the desktop / file explorer)
// is distinct from an internal drag of an existing gallery card — the browser
// reports it via dataTransfer.types, before any drop actually happens.
function isFileDrag(event: DragEvent): boolean {
  return Boolean(event.dataTransfer?.types?.includes("Files"));
}

export function MediaFolderTree({
  folders,
  selectedFolderId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onFileDrop,
}: {
  folders: MediaFolder[];
  selectedFolderId: number | null;
  onSelect: (id: number | null) => void;
  onCreate: (name: string, parentId: number | null) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (folder: MediaFolder) => void;
  onFileDrop?: (folderId: number | null, files: FileList) => void;
}) {
  const tree = buildTree(folders);
  const [creatingParentId, setCreatingParentId] = useState<number | "root-create" | "none">("none");
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [fileDropTarget, setFileDropTarget] = useState<number | "root" | null>(null);

  const startCreate = (parentId: number | null) => {
    setCreatingParentId(parentId === null ? "root-create" : parentId);
    setNewName("");
  };

  const submitCreate = (parentId: number | null) => {
    const trimmed = newName.trim();
    if (trimmed) onCreate(trimmed, parentId);
    setCreatingParentId("none");
    setNewName("");
  };

  const startRename = (folder: MediaFolder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (renamingId && trimmed) onRename(renamingId, trimmed);
    setRenamingId(null);
  };

  const toggleCollapsed = (id: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>, parentId: number | null) => {
    if (event.key === "Enter") submitCreate(parentId);
    if (event.key === "Escape") setCreatingParentId("none");
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") submitRename();
    if (event.key === "Escape") setRenamingId(null);
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const isSelected = selectedFolderId === node.id;
    const isDropTarget = fileDropTarget === node.id;
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <div
                onDragOver={(event) => {
                  if (onFileDrop && isFileDrag(event)) event.preventDefault();
                }}
                onDragEnter={(event) => {
                  if (onFileDrop && isFileDrag(event)) setFileDropTarget(node.id);
                }}
                onDragLeave={() => setFileDropTarget(null)}
                onDrop={(event) => {
                  if (onFileDrop && isFileDrag(event)) {
                    event.preventDefault();
                    setFileDropTarget(null);
                    if (event.dataTransfer.files.length) onFileDrop(node.id, event.dataTransfer.files);
                  }
                }}
                className={cn(
                  "group flex items-center gap-1 rounded-[10px] py-2 pr-1 text-[13px] font-semibold",
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted",
                  isDropTarget && "ring-2 ring-accent",
                )}
                style={{ paddingLeft: `${depth * 16 + 4}px` }}
              />
            }
          >
            <button
              type="button"
              onClick={() => (hasChildren ? toggleCollapsed(node.id) : undefined)}
              className={cn("flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground", !hasChildren && "opacity-0")}
              tabIndex={-1}
            >
              {hasChildren && (isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
            </button>

            {renamingId === node.id ? (
              <Input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={submitRename}
                className="h-7 flex-1 text-sm"
              />
            ) : (
              <button type="button" onClick={() => onSelect(node.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {isSelected ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="truncate">{node.name}</span>
                <span className={cn("ml-auto shrink-0 text-[11px]", isSelected ? "text-accent-foreground/70" : "text-muted-foreground")}>{node.itemCount}</span>
              </button>
            )}

            {renamingId !== node.id && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Επιλογές φακέλου"
                      className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-black/10 hover:text-foreground group-hover:opacity-100"
                      onClick={(event) => event.stopPropagation()}
                    />
                  }
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => startRename(node)}>
                    <Pencil className="h-4 w-4" /> Μετονομασία
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(node)}>
                    <Trash2 className="h-4 w-4" /> Διαγραφή
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onSelect(node.id)}>
              <Folder className="h-4 w-4" /> Άνοιγμα
            </ContextMenuItem>
            <ContextMenuItem onClick={() => startRename(node)}>
                <Pencil className="h-4 w-4" /> Μετονομασία
              </ContextMenuItem>
            <ContextMenuItem onClick={() => startCreate(node.id)}>
              <FolderPlus className="h-4 w-4" /> Νέος υποφάκελος
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => onDelete(node)}>
                  <Trash2 className="h-4 w-4" /> Διαγραφή
                </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {creatingParentId === node.id && (
          <div className="flex items-center gap-1 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}>
            <Input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => handleCreateKeyDown(event, node.id)}
              onBlur={() => submitCreate(node.id)}
              placeholder="Όνομα φακέλου"
              className="h-7 flex-1 text-sm"
            />
          </div>
        )}

        {!isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted-foreground">Φάκελοι</span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => startCreate(null)} aria-label="Νέος φάκελος" className="size-8 rounded-full hover:bg-muted">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {creatingParentId === "root-create" && (
          <div className="flex items-center gap-1 py-1 pl-1">
            <Input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => handleCreateKeyDown(event, null)}
              onBlur={() => submitCreate(null)}
              placeholder="Όνομα φακέλου"
              className="h-7 flex-1 text-sm"
            />
          </div>
        )}

        <div
          onDragOver={(event) => {
            if (onFileDrop && isFileDrag(event)) event.preventDefault();
          }}
          onDragEnter={(event) => {
            if (onFileDrop && isFileDrag(event)) setFileDropTarget("root");
          }}
          onDragLeave={() => setFileDropTarget(null)}
          onDrop={(event) => {
            if (onFileDrop && isFileDrag(event)) {
              event.preventDefault();
              setFileDropTarget(null);
              if (event.dataTransfer.files.length) onFileDrop(null, event.dataTransfer.files);
            }
          }}
          className={cn(
            "mb-1 flex items-center gap-2 rounded-[10px] py-2 pl-2 pr-2 text-[13px] font-semibold",
            selectedFolderId === null ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
            fileDropTarget === "root" ? "ring-2 ring-accent" : "",
          )}
        >
          <button type="button" onClick={() => onSelect(null)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {selectedFolderId === null ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">Όλα τα αρχεία</span>
          </button>
        </div>

        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
}
