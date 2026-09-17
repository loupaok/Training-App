"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { NutritionTemplatePreview, type NutritionTemplateDetail } from "@/components/shared/template-preview";

interface NutritionTemplateRow {
  id: number | string;
  title: string;
  goal?: string;
  daily_calories?: number;
  protein_g?: number | string;
  carbs_g?: number | string;
  fat_g?: number | string;
  meal_count?: number;
}

const goalLabels: Record<string, string> = {
  fat_loss: "Απώλεια λίπους",
  muscle_gain: "Μυϊκή μάζα",
  toning: "Σύσφιξη",
  maintenance: "Διατήρηση",
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function NutritionTemplatesContent() {
  const { user, logout } = useAuth();
  const [templates, setTemplates] = useState<NutritionTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewId, setPreviewId] = useState<number | string | null>(null);
  const [previewDetail, setPreviewDetail] = useState<NutritionTemplateDetail | null>(null);

  const loadTemplates = () => {
    setLoading(true);
    api
      .get<NutritionTemplateRow[]>("/templates/nutrition")
      .then(setTemplates)
      .catch((err) => setError(getErrorMessage(err, "Δεν φορτώθηκαν τα πρότυπα.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openPreview = async (id: number | string) => {
    setPreviewId(id);
    setPreviewDetail(null);
    try {
      const detail = await api.get<NutritionTemplateDetail>(`/templates/nutrition/${id}`);
      setPreviewDetail(detail);
    } catch (err) {
      setError(getErrorMessage(err, "Δεν φορτώθηκε το πρότυπο."));
      setPreviewId(null);
    }
  };

  const deleteTemplate = async (id: number | string) => {
    if (!window.confirm("Διαγραφή προτύπου; Τα πλάνα πελατών που βασίζονται σε αυτό δεν επηρεάζονται.")) return;
    try {
      await api.delete(`/templates/nutrition/${id}`);
      loadTemplates();
    } catch (err) {
      setError(getErrorMessage(err, "Δεν διαγράφηκε το πρότυπο."));
    }
  };

  return (
    <CoachShell title="Πρότυπα Διατροφής" user={user} logout={logout}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold dark:text-slate-50">Πρότυπα Διατροφής</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Φτιάξε ένα πρόγραμμα διατροφής μία φορά, ανάθεσέ το σε όσους πελάτες θέλεις.
          </p>
        </div>
        <Button type="button" className="gap-2" nativeButton={false} render={<Link href="/coach/templates/nutrition/new" />}>
          <Plus className="h-4 w-4" />
          Νέο Πρότυπο
        </Button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.title}</CardTitle>
              {template.goal && (
                <div className="mt-2">
                  <Badge variant="secondary">{goalLabels[template.goal] || template.goal}</Badge>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {template.daily_calories ? `${template.daily_calories} kcal` : "-"} · P {template.protein_g ?? "-"} / C {template.carbs_g ?? "-"} / F{" "}
                {template.fat_g ?? "-"} · {template.meal_count ?? 0} γεύματα
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => openPreview(template.id)}>
                  <Eye className="h-4 w-4" />
                  Προεπισκόπηση
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/coach/templates/nutrition/${template.id}`} />}
                >
                  <Pencil className="h-4 w-4" />
                  Επεξεργασία
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => deleteTemplate(template.id)} aria-label="Διαγραφή">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && !templates.length && (
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν υπάρχουν πρότυπα διατροφής ακόμα.</p>
        )}
      </div>

      <Dialog open={Boolean(previewId)} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Προεπισκόπηση Προτύπου</DialogTitle>
            <DialogDescription>Μόνο για προβολή.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {!previewDetail && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>}
            {previewDetail && <NutritionTemplatePreview template={previewDetail} />}
          </div>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

export default function NutritionTemplatesPage() {
  return (
    <ProtectedRoute allow="coach">
      <NutritionTemplatesContent />
    </ProtectedRoute>
  );
}
