"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Grid2X2, Link2, Pencil, Pill, Plus, Save, Search, Trash2, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DoseUnit = "ml" | "gr" | "mg";
type Supplement = {
  id: number;
  name: string;
  dose_amount: number | string | null;
  dose_unit: DoseUnit;
  times_per_day: number | string | null;
  link: string | null;
};
type SupplementTemplate = { id: number | string; title: string; notes?: string; items: Array<{ name: string; dosage?: string; timing?: string; link_url?: string; linkUrl?: string }> };

const doseUnits: DoseUnit[] = ["ml", "gr", "mg"];
const emptyForm = { name: "", doseAmount: "", doseUnit: "mg" as DoseUnit, timesPerDay: "", link: "" };

export function SupplementsPanel({ clientId }: { clientId: string | number }) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingSection, setTogglingSection] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [templates, setTemplates] = useState<SupplementTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<SupplementTemplate | null>(null);
  const [loadingTemplateDetail, setLoadingTemplateDetail] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const filteredTemplates = templates.filter((template) => template.title.toLocaleLowerCase("el-GR").includes(templateQuery.trim().toLocaleLowerCase("el-GR")));

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<{ items: Supplement[]; generalNotes: string; enabled: boolean }>(`/clients/${clientId}/supplements`);
      setSupplements(result.items);
      setGeneralNotes(result.generalNotes || "");
      setEnabled(result.enabled);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκαν τα συμπληρώματα.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    api.get<SupplementTemplate[]>("/templates/supplements").then(setTemplates).catch(() => setTemplates([]));
  }, [clientId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplateDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingTemplateDetail(true);
    api.get<SupplementTemplate>(`/templates/supplements/${selectedTemplateId}`)
      .then((template) => {
        if (!cancelled) {
          setSelectedTemplateDetail(template);
          setTemplates((current) => current.map((item) => String(item.id) === selectedTemplateId ? template : item));
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedTemplateDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplateDetail(false);
      });
    return () => { cancelled = true; };
  }, [selectedTemplateId]);

  const applyTemplate = async () => {
    let template = selectedTemplateDetail || templates.find((item) => String(item.id) === selectedTemplateId);
    if (template && !template.items?.length) template = await api.get<SupplementTemplate>(`/templates/supplements/${template.id}`);
    if (!template?.items?.length) return;
    setApplyingTemplate(true);
    try {
      const created = await Promise.all(template.items.map(async (item) => {
        const match = String(item.dosage || "").match(/([\d.,]+)\s*(mg|ml|gr|g)?/i);
        return api.post<Supplement>(`/clients/${clientId}/supplements`, {
          name: item.name,
          doseAmount: match ? Number(match[1].replace(",", ".")) : null,
          doseUnit: match?.[2]?.toLowerCase() === "g" ? "gr" : match?.[2]?.toLowerCase() || "mg",
          timesPerDay: 1,
          link: item.linkUrl || item.link_url || "",
        });
      }));
      setSupplements((current) => [...current, ...created]);
      if (template.notes?.trim()) {
        const nextNotes = template.notes?.trim() || "";
        setGeneralNotes(nextNotes);
        await api.put(`/clients/${clientId}/supplements/notes`, { generalNotes: nextNotes });
      }
      setSelectedTemplateId("");
      setSelectedTemplateDetail(null);
      setTemplateDialogOpen(false);
      setTemplateQuery("");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Δεν εφαρμόστηκε το πρότυπο.");
    } finally { setApplyingTemplate(false); }
  };

  const startEdit = (supplement: Supplement) => {
    setEditingId(supplement.id);
    setForm({
      name: supplement.name,
      doseAmount: supplement.dose_amount != null ? String(supplement.dose_amount) : "",
      doseUnit: supplement.dose_unit,
      timesPerDay: supplement.times_per_day != null ? String(supplement.times_per_day) : "",
      link: supplement.link || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submitSupplement = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const updated = await api.put<Supplement>(`/clients/${clientId}/supplements/${editingId}`, form);
        setSupplements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await api.post<Supplement>(`/clients/${clientId}/supplements`, form);
        setSupplements((current) => [...current, created]);
      }
      cancelEdit();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Δεν αποθηκεύτηκε το συμπλήρωμα.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplement = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/clients/${clientId}/supplements/${id}`);
      setSupplements((current) => current.filter((item) => item.id !== id));
    } catch {
      // Keep the row visible if the delete failed — the user can retry.
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSection = async (next: boolean) => {
    setTogglingSection(true);
    setEnabled(next);
    try {
      await api.patch(`/clients/${clientId}/supplements/toggle`, { enabled: next });
    } catch (toggleError) {
      setEnabled(!next);
      setError(toggleError instanceof Error ? toggleError.message : "Δεν ενημερώθηκε η ενότητα συμπληρωμάτων.");
    } finally {
      setTogglingSection(false);
    }
  };

  const saveGeneralNotes = async () => {
    setSavingNotes(true);
    try {
      await api.put(`/clients/${clientId}/supplements/notes`, { generalNotes });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Δεν αποθηκεύτηκαν οι σημειώσεις.");
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Φόρτωση συμπληρωμάτων...</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/40 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Pill className="h-4 w-4" />
            Συμπληρώματα
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Εμφανίζεται στον πελάτη μόνο όταν είναι ενεργό.</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(next) => void toggleSection(next)}
          disabled={togglingSection}
          aria-label="Ενεργοποίηση ενότητας συμπληρωμάτων"
        />
      </div>
      {enabled && <CardContent className="space-y-5 p-5">
        {error && (
          <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {templates.length > 0 && <><Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(true)} className="h-10 rounded-full px-4 text-[13px] font-extrabold"><Grid2X2 className="mr-1.5 size-4" />Ανάθεση από πρότυπο</Button><Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}><DialogContent className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1280px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[26px] border-0 p-0"><DialogHeader className="flex-row items-center gap-3 border-b border-border px-6 py-5 text-left"><span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-[#0b0b0b] text-accent"><Grid2X2 className="size-[17px]" /></span><span className="min-w-0 flex-1"><DialogTitle className="text-[19px] font-extrabold">Ανάθεση συμπληρωμάτων από πρότυπο</DialogTitle><DialogDescription className="mt-1 text-xs">Επίλεξε το πρότυπο που θα προστεθεί στα συμπληρώματα του πελάτη.</DialogDescription></span></DialogHeader><div className="grid min-h-0 overflow-hidden md:grid-cols-[330px_minmax(0,1fr)]"><aside className="space-y-3 overflow-y-auto border-b border-border bg-muted/30 p-[18px] md:border-b-0 md:border-r"><label className="flex h-[38px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] text-muted-foreground"><Search className="size-4" /><Input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Αναζήτηση προτύπου…" className="h-auto border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0" /></label><div className="space-y-2">{filteredTemplates.map((template) => { const selected = selectedTemplateId === String(template.id); return <button key={template.id} type="button" onClick={() => setSelectedTemplateId(String(template.id))} className={`w-full rounded-[14px] border bg-card p-3 text-left ${selected ? "border-2 border-[#0b0b0b]" : "border-border hover:border-foreground/50"}`}><span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{template.title}</b>{selected && <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-extrabold text-accent-foreground">Επιλεγμένο</span>}</span><small className="mt-1 block text-xs text-muted-foreground">Πρότυπο συμπληρωμάτων</small></button>; })}</div></aside><section className="min-w-0 overflow-y-auto p-5 sm:p-[22px]">{(() => { const selected = templates.find((template) => String(template.id) === selectedTemplateId); return selected ? <div className="space-y-3"><h3 className="text-[17px] font-extrabold">{selected.title}</h3><div className="min-h-full space-y-2 rounded-[16px] border border-border p-4">{selected.items?.length ? selected.items.map((item, index) => <div key={`${item.name}-${index}`} className="border-b border-border py-2 last:border-0"><b className="block text-sm">{item.name}</b><small className="text-xs text-muted-foreground">{item.dosage || "Δοσολογία κατά το πρότυπο"}{item.timing ? ` · ${item.timing}` : ""}</small></div>) : <p className="text-sm text-muted-foreground">Η προεπισκόπηση θα φορτωθεί κατά την ανάθεση.</p>}</div></div> : <div className="grid min-h-56 place-items-center rounded-[16px] border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Επίλεξε ένα πρότυπο από τη λίστα.</div>; })()}</section></div><DialogFooter className="border-t border-border px-6 py-4 sm:justify-end"><Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)} className="h-[42px] rounded-full px-4 text-[13px] font-extrabold">Ακύρωση</Button><Button type="button" variant="lime" disabled={!selectedTemplateId || applyingTemplate} onClick={() => void applyTemplate()} className="h-[42px] rounded-full px-5 text-[14px] font-extrabold">{applyingTemplate ? "Ανάθεση…" : "Ανάθεση & επεξεργασία"}</Button></DialogFooter></DialogContent></Dialog></>}
        {supplements.length > 0 && (
          <div className="space-y-2">
            {supplements.map((supplement) => (
              <div key={supplement.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  {supplement.link ? (
                    <a
                      href={supplement.link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                      {supplement.name}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold">{supplement.name}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {supplement.dose_amount ? `${supplement.dose_amount} ${supplement.dose_unit}` : null}
                    {supplement.dose_amount && supplement.times_per_day ? " · " : null}
                    {supplement.times_per_day ? `${supplement.times_per_day}x / ημέρα` : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Επεξεργασία συμπληρώματος"
                    onClick={() => startEdit(supplement)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Αφαίρεση συμπληρώματος"
                    disabled={deletingId === supplement.id}
                    onClick={() => void deleteSupplement(supplement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submitSupplement} className="space-y-3 border-t border-border pt-4">
          {editingId && (
            <p className="text-xs font-semibold text-muted-foreground">Επεξεργασία συμπληρώματος</p>
          )}
          <Input
            placeholder="Όνομα συμπληρώματος"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Δόση"
              value={form.doseAmount}
              onChange={(event) => setForm((current) => ({ ...current, doseAmount: event.target.value }))}
            />
            <Select value={form.doseUnit} onValueChange={(unit) => setForm((current) => ({ ...current, doseUnit: unit as DoseUnit }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doseUnits.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              placeholder="Φορές / ημέρα"
              className="col-span-2 sm:col-span-1"
              value={form.timesPerDay}
              onChange={(event) => setForm((current) => ({ ...current, timesPerDay: event.target.value }))}
            />
            <Input
              placeholder="Σύνδεσμος (προαιρετικό)"
              className="col-span-2 sm:col-span-1"
              value={form.link}
              onChange={(event) => setForm((current) => ({ ...current, link: event.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {saving ? "Αποθήκευση..." : editingId ? "Αποθήκευση αλλαγών" : "Προσθήκη συμπληρώματος"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                <X className="mr-2 h-4 w-4" />
                Ακύρωση
              </Button>
            )}
          </div>
        </form>

        <div className="border-t border-border pt-4">
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Γενικές σημειώσεις</Label>
          <Textarea
            rows={3}
            placeholder="Γενικές οδηγίες για τα συμπληρώματα του πελάτη..."
            value={generalNotes}
            onChange={(event) => setGeneralNotes(event.target.value)}
          />
          <Button type="button" variant="outline" className="mt-2" onClick={() => void saveGeneralNotes()} disabled={savingNotes}>
            <Save className="mr-2 h-4 w-4" />
            {savingNotes ? "Αποθήκευση..." : "Αποθήκευση σημειώσεων"}
          </Button>
        </div>
      </CardContent>}
    </Card>
  );
}
