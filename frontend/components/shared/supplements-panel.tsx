"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Link2, Pencil, Pill, Plus, Save, Trash2, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
  const [applyingTemplate, setApplyingTemplate] = useState(false);

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

  const applyTemplate = async () => {
    let template = templates.find((item) => String(item.id) === selectedTemplateId);
    if (template) template = await api.get<SupplementTemplate>(`/templates/supplements/${template.id}`);
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

        {templates.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-3"><Select value={selectedTemplateId || "__none"} onValueChange={(value) => setSelectedTemplateId(!value || value === "__none" ? "" : value)}><SelectTrigger className="min-w-56 flex-1"><SelectValue placeholder="Επιλογή προτύπου" /></SelectTrigger><SelectContent><SelectItem value="__none">Επιλογή προτύπου</SelectItem>{templates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.title}</SelectItem>)}</SelectContent></Select><Button type="button" disabled={!selectedTemplateId || applyingTemplate} onClick={() => void applyTemplate()}>{applyingTemplate ? "Προσθήκη…" : "Εφαρμογή προτύπου"}</Button></div>}
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
