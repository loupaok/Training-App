"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Pencil, Trash2, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
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

export function MediaFolderTree({
  folders,
  selectedFolderId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  dragActive,
  dropTargetId,
  onDropTargetChange,
  onDropAsset,
}: {
  folders: MediaFolder[];
  selectedFolderId: number | null;
  onSelect: (id: number | null) => void;
  onCreate: (name: string, parentId: number | null) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (folder: MediaFolder) => void;
  dragActive: boolean;
  dropTargetId: number | null | "root";
  onDropTargetChange: (id: number | null | "root") => void;
  onDropAsset: (folderId: number | null) => void;
}) {
  const tree = buildTree(folders);
  const [creatingParentId, setCreatingParentId] = useState<number | "root-create" | "none">("none");
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

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
    const isDropTarget = dragActive && dropTargetId === node.id;
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <div
                onDragOver={(event) => {
                  if (!dragActive) return;
                  event.preventDefault();
                }}
                onDragEnter={() => dragActive && onDropTargetChange(node.id)}
                onDragLeave={() => dragActive && onDropTargetChange(null)}
                onDrop={(event) => {
                  if (!dragActive) return;
                  event.preventDefault();
                  onDropAsset(node.id);
                }}
                className={cn(
                  "group flex items-center gap-1 rounded-md py-1.5 pr-1 text-sm",
                  isSelected ? "bg-red-50 font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
                  isDropTarget && "ring-2 ring-red-400",
                )}
                style={{ paddingLeft: `${depth * 16 + 4}px` }}
              />
            }
          >
            <button
              type="button"
              onClick={() => (hasChildren ? toggleCollapsed(node.id) : undefined)}
              className={cn("flex h-5 w-5 shrink-0 items-center justify-center text-slate-400", !hasChildren && "opacity-0")}
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
                {isSelected ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0 text-slate-400" />}
                <span className="truncate">{node.name}</span>
                <span className="ml-auto shrink-0 text-xs text-slate-400">{node.itemCount}</span>
              </button>
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
      <div className="flex-1 overflow-y-auto p-2">
        <div
          onDragOver={(event) => dragActive && event.preventDefault()}
          onDragEnter={() => dragActive && onDropTargetChange("root")}
          onDragLeave={() => dragActive && onDropTargetChange(null)}
          onDrop={(event) => {
            if (!dragActive) return;
            event.preventDefault();
            onDropAsset(null);
          }}
          className={cn(
            "mb-1 flex items-center gap-2 rounded-md py-1.5 pl-1 pr-2 text-sm",
            selectedFolderId === null ? "bg-red-50 font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
            dragActive && dropTargetId === "root" && "ring-2 ring-red-400",
          )}
        >
          <button type="button" onClick={() => onSelect(null)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {selectedFolderId === null ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="truncate">Όλα τα αρχεία</span>
          </button>
        </div>

        {tree.map((node) => renderNode(node, 0))}

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
      </div>

      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <Button type="button" variant="ghost" size="sm" onClick={() => startCreate(null)} className="w-full justify-start gap-2 font-normal text-slate-600 dark:text-slate-300">
          <Plus className="h-4 w-4" /> Νέος Φάκελος
        </Button>
      </div>
    </div>
  );
}
