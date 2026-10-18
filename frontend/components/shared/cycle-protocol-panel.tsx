"use client";

import { useEffect, useState } from "react";
import { ClipboardPlus, LockKeyhole, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type CompoundForm = { name: string; dose: string; unit: string; frequency: string; startWeek: string; endWeek: string };
type CycleForm = { isActive: boolean; totalWeeks: string; currentWeek: string; pctProtocol: string; pctStartWeek: string; estrogenControl: string; organSupport: string; coachNotes: string; clientNotes: string; compounds: CompoundForm[] };
type CycleResponse = { cycle: Record<string, unknown> & { compounds: Array<Record<string, unknown>> } | null };

const units = ["mg", "ml", "IU", "mcg"];
const emptyCompound = (): CompoundForm => ({ name: "", dose: "", unit: "mg", frequency: "", startWeek: "1", endWeek: "" });
const emptyForm = (): CycleForm => ({ isActive: false, totalWeeks: "12", currentWeek: "1", pctProtocol: "", pctStartWeek: "", estrogenControl: "", organSupport: "", coachNotes: "", clientNotes: "", compounds: [emptyCompound()] });

function toForm(cycle: NonNullable<CycleResponse["cycle"]>): CycleForm {
  return {
    isActive: Boolean(cycle.is_active), totalWeeks: String(cycle.total_weeks ?? 12), currentWeek: String(cycle.current_week ?? 1), pctProtocol: String(cycle.pct_protocol ?? ""), pctStartWeek: cycle.pct_start_week == null ? "" : String(cycle.pct_start_week), estrogenControl: String(cycle.estrogen_control ?? ""), organSupport: String(cycle.organ_support ?? ""), coachNotes: String(cycle.coach_notes ?? ""), clientNotes: String(cycle.client_notes ?? ""),
    compounds: cycle.compounds.length ? cycle.compounds.map((compound) => ({ name: String(compound.name ?? ""), dose: String(compound.dose ?? ""), unit: String(compound.unit ?? "mg"), frequency: String(compound.frequency ?? ""), startWeek: String(compound.start_week ?? 1), endWeek: compound.end_week == null ? "" : String(compound.end_week) })) : [emptyCompound()],
  };
}

export function CycleProtocolPanel({ planId }: { planId: number; clientId?: string | number | null }) {
  const [cycle, setCycle] = useState<CycleResponse["cycle"]>(null);
  const [form, setForm] = useState<CycleForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await api.get<CycleResponse>(`/nutrition-plans/${planId}/cycle`);
      setCycle(result.cycle); setForm(result.cycle ? toForm(result.cycle) : emptyForm());
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκε το Cycle Protocol."); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [planId]);

  const updateCompound = (index: number, patch: Partial<CompoundForm>) => setForm((current) => ({ ...current, compounds: current.compounds.map((compound, row) => row === index ? { ...compound, ...patch } : compound) }));
  const persist = async (nextForm: CycleForm, toggleOnly = false) => {
    setSaving(true); setError(""); setMessage("");
    try {
      const result = toggleOnly && cycle ? await api.patch<CycleResponse>(`/nutrition-plans/${planId}/cycle/toggle`, { isActive: nextForm.isActive }) : await (cycle ? api.put<CycleResponse>(`/nutrition-plans/${planId}/cycle`, nextForm) : api.post<CycleResponse>(`/nutrition-plans/${planId}/cycle`, nextForm));
      setCycle(result.cycle); if (result.cycle) setForm(toForm(result.cycle));
      setMessage(toggleOnly ? "Η κατάσταση ενημερώθηκε και ο πελάτης ειδοποιήθηκε." : "Το Cycle Protocol αποθηκεύτηκε και ο πελάτης ειδοποιήθηκε.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Δεν αποθηκεύτηκε το Cycle Protocol."); } finally { setSaving(false); }
  };
  const toggle = (checked: boolean) => { const next = { ...form, isActive: checked }; setForm(next); if (cycle) void persist(next, true); };

  if (loading) return <Card className="border-[#E53935]/20"><CardContent className="p-5 text-sm text-muted-foreground">Φόρτωση Cycle Protocol...</CardContent></Card>;
  return <Card className="overflow-hidden border-border shadow-none">
    <div className="flex items-center justify-between gap-4 border-b border-[#E53935]/20 bg-[#E53935]/[0.08] px-5 py-4">
      <div><div className="flex items-center gap-2 text-sm font-bold text-[#E53935]"><ClipboardPlus className="h-4 w-4" />Cycle Protocol</div><p className="mt-0.5 text-xs text-muted-foreground">Εμφανίζεται στον πελάτη μόνο όταν είναι ενεργό.</p></div>
      <Switch checked={form.isActive} onCheckedChange={toggle} disabled={saving} aria-label="Ενεργοποίηση Cycle Protocol" />
    </div>
    {form.isActive && <CardContent className="space-y-5 p-5">
      {error && <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      {message && <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      <div>
        <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Σκευάσματα</Label>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_2.25rem] gap-2 px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>Όνομα</span><span>Δόση</span><span>Συχνότητα</span><span /></div>
        <div className="space-y-2">{form.compounds.map((compound, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_2.25rem] items-center gap-2">
          <Input placeholder="π.χ. Testosterone E" value={compound.name} onChange={(event) => updateCompound(index, { name: event.target.value })} />
          <div className="flex min-w-0 gap-1"><Input aria-label="Δόση" type="number" min={0} step="0.01" className="min-w-0 px-2" placeholder="500" value={compound.dose} onChange={(event) => updateCompound(index, { dose: event.target.value })} /><Select value={compound.unit} onValueChange={(unit) => updateCompound(index, { unit: unit || "mg" })}><SelectTrigger className="w-12 px-1 text-xs"><SelectValue /></SelectTrigger><SelectContent>{units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
          <Input placeholder="2x / εβδομάδα" value={compound.frequency} onChange={(event) => updateCompound(index, { frequency: event.target.value })} />
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-[#E53935]" aria-label="Αφαίρεση σκευάσματος" onClick={() => setForm((current) => ({ ...current, compounds: current.compounds.length === 1 ? [emptyCompound()] : current.compounds.filter((_, row) => row !== index) }))}><Trash2 className="h-4 w-4" /></Button>
        </div>)}</div>
        <Button type="button" variant="outline" className="mt-3 w-full border-dashed text-muted-foreground hover:border-[#E53935] hover:text-[#E53935]" onClick={() => setForm((current) => ({ ...current, compounds: [...current.compounds, emptyCompound()] }))}><Plus className="mr-2 h-4 w-4" />Προσθήκη σκευάσματος</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><div><Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Συνολικές εβδομάδες</Label><Input type="number" min={1} max={104} value={form.totalWeeks} onChange={(event) => setForm((current) => ({ ...current, totalWeeks: event.target.value }))} /></div><div><Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Τρέχουσα εβδομάδα</Label><Input type="number" min={1} value={form.currentWeek} onChange={(event) => setForm((current) => ({ ...current, currentWeek: event.target.value }))} /></div></div>
      <div><Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Σημείωση για τον πελάτη</Label><Textarea rows={3} value={form.clientNotes} onChange={(event) => setForm((current) => ({ ...current, clientNotes: event.target.value }))} /></div>
      <div><div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Ιδιωτικές σημειώσεις coach</div><Textarea rows={3} value={form.coachNotes} onChange={(event) => setForm((current) => ({ ...current, coachNotes: event.target.value }))} /></div>
      <Button type="button" className="w-full bg-[#E53935] text-white hover:bg-[#C62828]" onClick={() => void persist(form)} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Αποθήκευση..." : "Αποθήκευση Cycle Protocol"}</Button>
    </CardContent>}
  </Card>;
}
