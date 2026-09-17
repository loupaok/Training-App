"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import {
  TrainingTemplatePreview,
  NutritionTemplatePreview,
  type TrainingTemplateDetail,
  type NutritionTemplateDetail,
} from "@/components/shared/template-preview";

interface TemplateListRow {
  id: number | string;
  title: string;
}

export function AssignTemplateDialog({
  kind,
  clientId,
  onAssigned,
}: {
  kind: "training" | "nutrition";
  clientId: string;
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateListRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<TrainingTemplateDetail | NutritionTemplateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  const endpoint = kind === "training" ? "assign-training-template" : "assign-nutrition-template";

  useEffect(() => {
    if (!open) return;
    api
      .get<TemplateListRow[]>(`/templates/${kind}`)
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open, kind]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    api
      .get<TrainingTemplateDetail | NutritionTemplateDetail>(`/templates/${kind}/${selectedId}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId, kind]);

  const confirmAssign = async () => {
    if (!selectedId) return;
    setAssigning(true);
    setError("");
    try {
      await api.post(`/clients/${clientId}/${endpoint}`, { templateId: Number(selectedId) });
      setOpen(false);
      setSelectedId("");
      setDetail(null);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε ανάθεση προτύπου.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="h-9 gap-2 text-sm font-bold">
            <Sparkles className="h-4 w-4" />
            Ανάθεση από Πρότυπο
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ανάθεση από Πρότυπο</DialogTitle>
          <DialogDescription>
            Το τρέχον πλάνο του πελάτη θα μετακινηθεί στο ιστορικό. Το πρότυπο δεν αλλάζει ποτέ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          <div>
            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Πρότυπο</Label>
            <Select
              items={templates.map((template) => ({ value: String(template.id), label: template.title }))}
              value={selectedId}
              onValueChange={(value) => setSelectedId(value ?? "")}
            >
              <SelectTrigger className="mt-1 h-11 w-full text-sm font-semibold">
                <SelectValue placeholder="Επίλεξε πρότυπο" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={String(template.id)}>
                    {template.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingDetail && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση προεπισκόπησης...</p>}
          {!loadingDetail && detail && (
            <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 p-3 dark:border-slate-800">
              {kind === "training" ? (
                <TrainingTemplatePreview template={detail as TrainingTemplateDetail} />
              ) : (
                <NutritionTemplatePreview template={detail as NutritionTemplateDetail} />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={confirmAssign} disabled={!selectedId || assigning}>
            {assigning ? "Ανάθεση..." : "Ανάθεση Προτύπου"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
