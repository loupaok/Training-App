"use client";

import { useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

const CATEGORIES = [
  { value: "proteins", label: "Πρωτεΐνες" },
  { value: "amino-acids", label: "Αμινοξέα" },
  { value: "vitamins-health", label: "Βιταμίνες" },
  { value: "fat-burners", label: "Λιποδιαλύτες & Έλεγχος Βάρους" },
  { value: "creatine", label: "Κρεατίνες" },
  { value: "pre-workout", label: "Pre-Workout" },
  { value: "carbohydrates", label: "Υδατάνθρακες" },
  { value: "foods", label: "Τρόφιμα" },
] as const;

type Supplement = { id: number | string; category: string; name: string };

function SupplementsContent() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ items: Supplement[] }>("/supplements")
      .then((response) => setItems(response.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CoachShell title="Βιβλιοθήκη Συμπληρωμάτων" user={user} logout={logout}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-7">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Pill className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Βιβλιοθήκη Συμπληρωμάτων</h1>
              <p className="mt-1 text-sm text-muted-foreground">Οργάνωσε τα συμπληρώματα ανά κατηγορία. Δεν χρησιμοποιούνται φωτογραφίες.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue={CATEGORIES[0].value}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg border bg-muted/50 p-1">
            {CATEGORIES.map((category) => (
              <TabsTrigger key={category.value} value={category.value} className="shrink-0 px-3 py-2 text-sm data-active:bg-background data-active:text-foreground">
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((category) => (
            <TabsContent key={category.value} value={category.value} className="mt-5">
              {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Φόρτωση...</p> : (
                <SupplementCategory category={category.value} label={category.label} items={items} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </CoachShell>
  );
}

function SupplementCategory({ category, label, items }: { category: string; label: string; items: Supplement[] }) {
  const categoryItems = items.filter((item) => item.category === category);
  if (!categoryItems.length) {
    return <div className="grid min-h-56 place-items-center rounded-lg border border-dashed bg-card px-6 text-center"><div><Pill className="mx-auto size-7 text-muted-foreground" /><h2 className="mt-3 text-base font-semibold">{label}</h2><p className="mt-1 text-sm text-muted-foreground">Δεν έχουν προστεθεί συμπληρώματα σε αυτή την κατηγορία ακόμη.</p></div></div>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categoryItems.map((item) => <div key={item.id} className="flex min-h-20 items-center gap-3 rounded-lg border bg-card p-4"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Pill className="size-4" /></div><p className="text-sm font-semibold">{item.name}</p></div>)}
    </div>
  );
}

export default function SupplementsPage() {
  return <ProtectedRoute allow="coach"><SupplementsContent /></ProtectedRoute>;
}
