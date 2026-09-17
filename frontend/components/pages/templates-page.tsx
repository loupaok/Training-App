"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import {
  TrainingPlanEditor,
  normalizeTrainingPlan,
  defaultTrainingPlan,
  type TrainingPlanState,
  type RawTrainingPlan,
  type LibraryExercise,
} from "@/components/shared/training-plan-editor";
import {
  NutritionPlanEditor,
  normalizeNutritionPlan,
  defaultNutritionPlan,
  type NutritionPlanState,
  type RawNutritionPlan,
} from "@/components/shared/nutrition-plan-editor";
import {
  TrainingTemplatePreview,
  NutritionTemplatePreview,
  type TrainingTemplateDetail,
  type NutritionTemplateDetail,
} from "@/components/shared/template-preview";

interface TrainingTemplateRow {
  id: number | string;
  title: string;
  goal?: string;
  level?: string;
  days_per_week?: number;
  day_count?: number;
  exercise_count?: number;
}

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

const levelLabels: Record<string, string> = {
  beginner: "Αρχάριο",
  intermediate: "Μεσαίο",
  advanced: "Προχωρημένο",
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function TemplatesContent() {
  const { user, logout } = useAuth();
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [trainingTemplates, setTrainingTemplates] = useState<TrainingTemplateRow[]>([]);
  const [nutritionTemplates, setNutritionTemplates] = useState<NutritionTemplateRow[]>([]);
  const [error, setError] = useState("");

  const [sheetKind, setSheetKind] = useState<"training" | "nutrition" | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  const [previewKind, setPreviewKind] = useState<"training" | "nutrition" | null>(null);
  const [previewDetail, setPreviewDetail] = useState<TrainingTemplateDetail | NutritionTemplateDetail | null>(null);

  const loadTemplates = () => {
    api
      .get<TrainingTemplateRow[]>("/templates/training")
      .then(setTrainingTemplates)
      .catch(() => setTrainingTemplates([]));
    api
      .get<NutritionTemplateRow[]>("/templates/nutrition")
      .then(setNutritionTemplates)
      .catch(() => setNutritionTemplates([]));
  };

  useEffect(() => {
    loadTemplates();
    api
      .get<LibraryExercise[]>("/exercises")
      .then((rows) => setExercises(Array.isArray(rows) ? rows : []))
      .catch(() => setExercises([]));
  }, []);

  const openPreview = async (kind: "training" | "nutrition", id: number | string) => {
    setPreviewKind(kind);
    setPreviewDetail(null);
    try {
      const detail = await api.get<TrainingTemplateDetail | NutritionTemplateDetail>(`/templates/${kind}/${id}`);
      setPreviewDetail(detail);
    } catch (err) {
      setError(getErrorMessage(err, "Δεν φορτώθηκε το πρότυπο."));
      setPreviewKind(null);
    }
  };

  const deleteTemplate = async (kind: "training" | "nutrition", id: number | string) => {
    if (!window.confirm("Διαγραφή προτύπου; Τα πλάνα πελατών που βασίζονται σε αυτό δεν επηρεάζονται.")) return;
    try {
      await api.delete(`/templates/${kind}/${id}`);
      loadTemplates();
    } catch (err) {
      setError(getErrorMessage(err, "Δεν διαγράφηκε το πρότυπο."));
    }
  };

  return (
    <CoachShell title="Βιβλιοθήκη Προτύπων" user={user} logout={logout}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold dark:text-slate-50">Βιβλιοθήκη Προτύπων</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Φτιάξε πρότυπα προπόνησης και διατροφής μία φορά, ανάθεσέ τα σε όσους πελάτες θέλεις.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <Tabs defaultValue="training">
        <TabsList>
          <TabsTrigger value="training">Πρότυπα Προπόνησης</TabsTrigger>
          <TabsTrigger value="nutrition">Πρότυπα Διατροφής</TabsTrigger>
        </TabsList>

        <TabsContent value="training" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setEditingId(null);
                setSheetKind("training");
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Νέο Πρότυπο
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {trainingTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.title}</CardTitle>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {template.goal && <Badge variant="secondary">{goalLabels[template.goal] || template.goal}</Badge>}
                    {template.level && <Badge variant="outline">{levelLabels[template.level] || template.level}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {template.days_per_week || template.day_count || 0} ημέρες/εβδομάδα · {template.exercise_count ?? 0} ασκήσεις
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openPreview("training", template.id)}>
                      <Eye className="h-4 w-4" />
                      Προεπισκόπηση
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(template.id);
                        setSheetKind("training");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Επεξεργασία
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => deleteTemplate("training", template.id)} aria-label="Διαγραφή">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!trainingTemplates.length && (
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν υπάρχουν πρότυπα προπόνησης ακόμα.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="nutrition" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setEditingId(null);
                setSheetKind("nutrition");
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Νέο Πρότυπο Διατροφής
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {nutritionTemplates.map((template) => (
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
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openPreview("nutrition", template.id)}>
                      <Eye className="h-4 w-4" />
                      Προεπισκόπηση
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(template.id);
                        setSheetKind("nutrition");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Επεξεργασία
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => deleteTemplate("nutrition", template.id)} aria-label="Διαγραφή">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!nutritionTemplates.length && (
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν υπάρχουν πρότυπα διατροφής ακόμα.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {sheetKind && (
        <TemplateEditorSheet
          kind={sheetKind}
          templateId={editingId}
          exercises={exercises}
          onClose={() => setSheetKind(null)}
          onSaved={() => {
            setSheetKind(null);
            loadTemplates();
          }}
        />
      )}

      <Dialog open={Boolean(previewKind)} onOpenChange={(open) => !open && setPreviewKind(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Προεπισκόπηση Προτύπου</DialogTitle>
            <DialogDescription>Μόνο για προβολή.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {!previewDetail && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>}
            {previewDetail && previewKind === "training" && <TrainingTemplatePreview template={previewDetail as TrainingTemplateDetail} />}
            {previewDetail && previewKind === "nutrition" && <NutritionTemplatePreview template={previewDetail as NutritionTemplateDetail} />}
          </div>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

function TemplateEditorSheet({
  kind,
  templateId,
  exercises,
  onClose,
  onSaved,
}: {
  kind: "training" | "nutrition";
  templateId: number | string | null;
  exercises: LibraryExercise[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlanState>(defaultTrainingPlan);
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlanState>(defaultNutritionPlan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!templateId) {
      setGoal("");
      setTrainingPlan(defaultTrainingPlan());
      setNutritionPlan(defaultNutritionPlan());
      return;
    }
    api.get<RawTrainingPlan | RawNutritionPlan>(`/templates/${kind}/${templateId}`).then((data) => {
      setGoal((data as { goal?: string }).goal || "");
      if (kind === "training") {
        setTrainingPlan(normalizeTrainingPlan(data as RawTrainingPlan));
      } else {
        setNutritionPlan(normalizeNutritionPlan(data as RawNutritionPlan));
      }
    });
  }, [kind, templateId]);

  const saveTrainingTemplate = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        title: trainingPlan.title,
        description: trainingPlan.description,
        goal: goal || null,
        level: trainingPlan.difficulty,
        daysPerWeek: trainingPlan.dayCount || trainingPlan.days.length,
        days: trainingPlan.days,
      };
      if (templateId) {
        await api.put(`/templates/training/${templateId}`, body);
      } else {
        await api.post("/templates/training", body);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Δεν αποθηκεύτηκε το πρότυπο."));
    } finally {
      setSaving(false);
    }
  };

  const saveNutritionTemplate = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        title: nutritionPlan.title,
        description: nutritionPlan.description,
        goal: goal || null,
        dailyCalories: nutritionPlan.dailyCalories,
        proteinG: nutritionPlan.proteinG,
        carbsG: nutritionPlan.carbsG,
        fatG: nutritionPlan.fatG,
        meals: nutritionPlan.meals,
      };
      if (templateId) {
        await api.put(`/templates/nutrition/${templateId}`, body);
      } else {
        await api.post("/templates/nutrition", body);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Δεν αποθηκεύτηκε το πρότυπο."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{templateId ? "Επεξεργασία Προτύπου" : "Νέο Πρότυπο"}</SheetTitle>
          <SheetDescription>
            {kind === "training" ? "Ίδιος builder με το πρόγραμμα προπόνησης πελάτη." : "Ίδιος builder με το πρόγραμμα διατροφής πελάτη."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="max-w-xs">
            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Στόχος</Label>
            <Select
              items={[
                { value: "fat_loss", label: "Απώλεια λίπους" },
                { value: "muscle_gain", label: "Μυϊκή μάζα" },
                { value: "toning", label: "Σύσφιξη" },
                { value: "maintenance", label: "Διατήρηση" },
              ]}
              value={goal}
              onValueChange={(value) => setGoal(value ?? "")}
            >
              <SelectTrigger className="mt-1 h-11 w-full text-sm font-semibold">
                <SelectValue placeholder="Επιλογή στόχου" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fat_loss">Απώλεια λίπους</SelectItem>
                <SelectItem value="muscle_gain">Μυϊκή μάζα</SelectItem>
                <SelectItem value="toning">Σύσφιξη</SelectItem>
                <SelectItem value="maintenance">Διατήρηση</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "training" ? (
            <TrainingPlanEditor
              plan={trainingPlan}
              setPlan={setTrainingPlan}
              exercises={exercises}
              onSave={saveTrainingTemplate}
              saving={saving}
              title="Πρόγραμμα Προπόνησης Προτύπου"
              subtitle="Αυτό είναι το πρότυπο, δεν ανήκει σε συγκεκριμένο πελάτη."
            />
          ) : (
            <NutritionPlanEditor
              plan={nutritionPlan}
              setPlan={setNutritionPlan}
              onSave={saveNutritionTemplate}
              saving={saving}
              title="Πρόγραμμα Διατροφής Προτύπου"
              subtitle="Αυτό είναι το πρότυπο, δεν ανήκει σε συγκεκριμένο πελάτη."
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function TemplatesPage() {
  return (
    <ProtectedRoute allow="coach">
      <TemplatesContent />
    </ProtectedRoute>
  );
}
