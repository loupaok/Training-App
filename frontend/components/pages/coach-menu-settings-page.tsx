"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { coachNavSections, type CoachNavSection } from "@/lib/nav-config";

type MenuResponse = { items: string[] };

function mergeOrder(items: string[]) {
  const sectionByKey = new Map(coachNavSections.map((section) => [section.key, section]));
  const ordered = items.map((key) => sectionByKey.get(key)).filter((section): section is CoachNavSection => Boolean(section));
  const included = new Set(ordered.map((section) => section.key));
  return [...ordered, ...coachNavSections.filter((section) => !included.has(section.key))];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Σφάλμα αποθήκευσης.";
}

function MenuSettingsContent() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const canSeeCoachSettings = user?.role === "admin" || user?.role === "coach";
  const visibleSections = useMemo(
    () => coachNavSections.filter((section) => (!section.coachOrAdminOnly || canSeeCoachSettings) && (!section.adminOnly || isAdmin)),
    [canSeeCoachSettings, isAdmin]
  );
  const defaultKeys = useMemo(() => visibleSections.map((section) => section.key), [visibleSections]);
  const [items, setItems] = useState<CoachNavSection[]>(visibleSections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeItem, setActiveItem] = useState<CoachNavSection | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [unreadUpdates, setUnreadUpdates] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    Promise.all([api.get<MenuResponse>("/settings/menu"), api.get<{ totalUnread: number }>("/updates/stats").catch(() => ({ totalUnread: 0 }))])
      .then(([menu, updates]) => {
        const ordered = mergeOrder(menu.items).filter((section) => visibleSections.some((item) => item.key === section.key));
        setItems(ordered);
        setUnreadUpdates(updates.totalUnread);
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [visibleSections]);

  const persist = async (nextItems: CoachNavSection[]) => {
    setSaving(true);
    try {
      const result = await api.put<MenuResponse>("/settings/menu", { items: nextItems.map((item) => item.key) });
      setItems(mergeOrder(result.items).filter((section) => nextItems.some((item) => item.key === section.key)));
      window.dispatchEvent(new Event("coach-menu-updated"));
      toast.success("Μενού αποθηκεύτηκε");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = ({ active }: DragStartEvent) => setActiveItem(items.find((item) => item.key === active.id) || null);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveItem(null);
    if (!over || active.id === over.id) return;
    setItems((current) => arrayMove(current, current.findIndex((item) => item.key === active.id), current.findIndex((item) => item.key === over.id)));
  };
  const resetToDefault = () => {
    const nextItems = defaultKeys.map((key) => visibleSections.find((section) => section.key === key)).filter((section): section is CoachNavSection => Boolean(section));
    setResetOpen(false);
    void persist(nextItems);
  };

  return <CoachShell title="Διαμόρφωση Μενού" user={user} logout={logout}>
    <main className="mx-auto max-w-3xl space-y-6 pb-8">
      <header><h1 className="text-3xl font-bold">Διαμόρφωση Μενού</h1><p className="mt-2 text-sm text-muted-foreground">Σύρε τα στοιχεία για να αλλάξεις τη σειρά εμφάνισης.</p></header>
      <Card>
        <CardHeader><CardTitle>Σειρά στοιχείων</CardTitle><CardDescription>Οι Ρυθμίσεις και η Διαχείριση μετακινούνται ως ενιαίες ομάδες.</CardDescription></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}><SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}><div className="overflow-hidden rounded-md border">{items.map((item) => <SortableMenuRow key={item.key} section={item} unreadUpdates={unreadUpdates} />)}</div></SortableContext><DragOverlay>{activeItem ? <MenuRow section={activeItem} unreadUpdates={unreadUpdates} overlay /> : null}</DragOverlay></DndContext>}
          <div className="mt-6 flex flex-wrap justify-between gap-3"><Button type="button" variant="outline" onClick={() => setResetOpen(true)} disabled={loading || saving}><RotateCcw />Επαναφορά προεπιλογών</Button><Button type="button" onClick={() => persist(items)} disabled={loading || saving}><Save />{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button></div>
        </CardContent>
      </Card>
    </main>
    <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Επαναφορά προεπιλογών;</AlertDialogTitle><AlertDialogDescription>Η σειρά του μενού θα επιστρέψει στην αρχική της μορφή.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Ακύρωση</AlertDialogCancel><AlertDialogAction onClick={resetToDefault}>Επαναφορά</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </CoachShell>;
}

function SortableMenuRow({ section, unreadUpdates }: { section: CoachNavSection; unreadUpdates: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.key });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-40" : ""}><MenuRow section={section} unreadUpdates={unreadUpdates} attributes={attributes} listeners={listeners} setActivatorNodeRef={setActivatorNodeRef} /></div>;
}

function MenuRow({ section, unreadUpdates, overlay = false, attributes, listeners, setActivatorNodeRef }: { section: CoachNavSection; unreadUpdates: number; overlay?: boolean; attributes?: ReturnType<typeof useSortable>["attributes"]; listeners?: ReturnType<typeof useSortable>["listeners"]; setActivatorNodeRef?: ReturnType<typeof useSortable>["setActivatorNodeRef"] }) {
  const Icon = section.icon;
  return <div className={`flex h-14 items-center gap-3 border-b bg-card px-3 last:border-b-0 ${overlay ? "rounded-md border border-primary shadow-lg" : ""}`}><button ref={setActivatorNodeRef} type="button" className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing" aria-label={`Μετακίνηση ${section.label}`} {...attributes} {...listeners}><GripVertical className="size-5" /></button>{Icon && <Icon className="size-4 text-muted-foreground" />}<span className="flex-1 text-sm font-medium">{section.label}</span>{section.key === "updates" && unreadUpdates > 0 && <Badge>{unreadUpdates}</Badge>}</div>;
}

export default function CoachMenuSettingsPage() { return <ProtectedRoute allow="coach"><MenuSettingsContent /></ProtectedRoute>; }
