"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function TrainingTemplateFormContent({ templateId }: { templateId: string | null }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<TrainingPlanState>(defaultTrainingPlan);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<LibraryExercise[]>("/exercises")
      .then((rows) => setExercises(Array.isArray(rows) ? rows : []))
      .catch(() => setExercises([]));

    if (!templateId) return;
    setLoading(true);
    api
      .get<RawTrainingPlan & { goal?: string }>(`/templates/training/${templateId}`)
      .then((data) => {
        setGoal(data.goal || "");
        setPlan(normalizeTrainingPlan(data));
      })
      .catch((err) => setError(getErrorMessage(err, "Δεν φορτώθηκε το πρότυπο.")))
      .finally(() => setLoading(false));
  }, [templateId]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        title: plan.title,
        description: plan.description,
        goal: goal || null,
        level: plan.difficulty,
        daysPerWeek: plan.dayCount || plan.days.length,
        days: plan.days,
      };
      if (templateId) {
        await api.put(`/templates/training/${templateId}`, body);
      } else {
        await api.post("/templates/training", body);
      }
      router.push("/coach/templates/training");
    } catch (err) {
      setError(getErrorMessage(err, "Δεν αποθηκεύτηκε το πρότυπο."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CoachShell title={templateId ? "Επεξεργασία Προτύπου" : "Νέο Πρότυπο Προπόνησης"} user={user} logout={logout}>
      <div className="mb-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 gap-1 px-2"
          nativeButton={false}
          render={<Link href="/coach/templates/training" />}
        >
          <ChevronLeft className="h-4 w-4" />
          Πρότυπα Προπόνησης
        </Button>
        <h1 className="text-3xl font-bold dark:text-slate-50">{templateId ? "Επεξεργασία Προτύπου" : "Νέο Πρότυπο Προπόνησης"}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Ίδιος builder με το πρόγραμμα προπόνησης πελάτη. Δεν ανήκει σε συγκεκριμένο πελάτη.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>
      ) : (
        <div className="space-y-6">
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

          <TrainingPlanEditor
            plan={plan}
            setPlan={setPlan}
            exercises={exercises}
            onSave={save}
            saving={saving}
            title="Πρόγραμμα Προπόνησης Προτύπου"
            subtitle="Διάλεξε ημέρες, βάλε ασκήσεις από τη βιβλιοθήκη και συμπλήρωσε Σετ, Επαναλ., Tempo και Rest."
          />
        </div>
      )}
    </CoachShell>
  );
}

export default function TrainingTemplateFormPage({ templateId }: { templateId: string | null }) {
  return (
    <ProtectedRoute allow="coach">
      <TrainingTemplateFormContent templateId={templateId} />
    </ProtectedRoute>
  );
}
