"use client";

import { useEffect, useState } from "react";
import { Grid2X2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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
  const [query, setQuery] = useState("");

  const endpoint = kind === "training" ? "assign-training-template" : "assign-nutrition-template";
  const planLabel = kind === "training" ? "προπόνησης" : "διατροφής";
  const filteredTemplates = templates.filter((template) => template.title.toLocaleLowerCase("el-GR").includes(query.trim().toLocaleLowerCase("el-GR")));

  useEffect(() => {
    if (!open) return;
    api
      .get<TemplateListRow[]>(`/templates/${kind}`)
      .then((rows) => {
        setTemplates(rows);
        setSelectedId((current) => current || (rows[0] ? String(rows[0].id) : ""));
      })
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
      setQuery("");
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
      <DialogContent className="h-[min(88dvh,900px)] w-[calc(100vw-3rem)] max-w-[1400px] sm:max-w-[1400px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[26px] border-0 p-0">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border px-6 py-5 text-left">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-[#0b0b0b] text-accent"><Grid2X2 className="size-[17px]" /></span>
          <span className="min-w-0 flex-1"><DialogTitle className="text-[19px] font-extrabold">Ανάθεση πλάνου {planLabel} από πρότυπο</DialogTitle><DialogDescription className="mt-1 text-xs">Επίλεξε πρότυπο, έλεγξε την προεπισκόπηση και κάνε ανάθεση στον πελάτη.</DialogDescription></span>
        </DialogHeader>

        <div className="grid min-h-0 overflow-hidden md:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-3 overflow-y-auto border-b border-border bg-muted/30 p-[18px] md:border-b-0 md:border-r">
            <label className="flex h-[38px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] text-muted-foreground"><Search className="size-4" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Αναζήτηση προτύπου…" className="h-auto border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0" /></label>
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1 md:max-h-[480px]">
              {filteredTemplates.map((template) => {
                const selected = selectedId === String(template.id);
                return <button key={template.id} type="button" onClick={() => setSelectedId(String(template.id))} className={`w-full rounded-[14px] border bg-card p-3 text-left transition-colors ${selected ? "border-2 border-[#0b0b0b]" : "border-border hover:border-foreground/50"}`}><span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{template.title}</b>{selected && <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-extrabold text-accent-foreground">Επιλεγμένο</span>}</span><small className="mt-1 block text-xs text-muted-foreground">Πρότυπο {planLabel}</small></button>;
              })}
              {!filteredTemplates.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Δεν βρέθηκε πρότυπο.</p>}
            </div>
          </aside>

          <section className="min-w-0 overflow-y-auto p-5 sm:p-[22px]">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}
          {!selectedId && <div className="grid min-h-56 place-items-center rounded-[16px] border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Επίλεξε ένα πρότυπο από τη λίστα.</div>}
          {loadingDetail && <p className="text-sm font-semibold text-muted-foreground">Φόρτωση προεπισκόπησης...</p>}
          {!loadingDetail && detail && (
            <div className="min-h-full rounded-[16px] border border-border p-4">
              {kind === "training" ? (
                <TrainingTemplatePreview template={detail as TrainingTemplateDetail} />
              ) : (
                <NutritionTemplatePreview template={detail as NutritionTemplateDetail} />
              )}
            </div>
          )}
          </section>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-[42px] rounded-full px-4 text-[13px] font-extrabold">Ακύρωση</Button>
          <Button type="button" variant="lime" onClick={confirmAssign} disabled={!selectedId || assigning} className="h-[42px] rounded-full px-5 text-[14px] font-extrabold">
            {assigning ? "Ανάθεση..." : "Ανάθεση & επεξεργασία"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
