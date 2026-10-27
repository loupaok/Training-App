"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Grid2X2, List, Pencil, Pill, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  ["proteins", "Πρωτεΐνες", "Πρωτεΐνες"], ["amino-acids", "Αμινοξέα", "Απόδοση"],
  ["vitamins-health", "Βιταμίνες", "Υγεία"], ["fat-burners", "Λιποδιαλύτες", "Απόδοση"],
  ["creatine", "Κρεατίνες", "Απόδοση"], ["pre-workout", "Pre-Workout", "Απόδοση"],
  ["carbohydrates", "Υδατάνθρακες", "Αποκατάσταση"], ["foods", "Τρόφιμα", "Αποκατάσταση"],
] as const;

type Supplement = { id: number | string; category: string; name: string; shortCode: string | null; form: string | null; dailyDose: number | string | null; doseUnit: string | null; timing: string | null; linkUrl: string | null };
type Form = Omit<Supplement, "id">;
const emptyForm: Form = { category: "proteins", name: "", shortCode: "", form: "", dailyDose: null, doseUnit: "g", timing: "", linkUrl: "" };

function categoryMeta(category: string) {
  const item = CATEGORIES.find(([value]) => value === category);
  return { label: item?.[1] || "Άλλα", tone: item?.[2] || "Αποκατάσταση" };
}
function visualTone(category: string) {
  const tone = categoryMeta(category).tone;
  return tone === "Πρωτεΐνες" ? "bg-[#0b0b0b] text-white" : tone === "Απόδοση" ? "bg-accent text-[#0b0b0b]" : tone === "Υγεία" ? "bg-[#ecece8] text-[#0b0b0b]" : "bg-[#1f1f1f] text-white";
}
function shortCode(item: Supplement) { return item.shortCode?.trim() || item.name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2) || "SP"; }

function SupplementsContent() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<Supplement[]>([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState("");
  const [category, setCategory] = useState(""); const [view, setView] = useState<"grid" | "list">("grid");
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<Supplement | null>(null); const [form, setForm] = useState<Form>(emptyForm); const [saving, setSaving] = useState(false);
  const load = () => { setLoading(true); api.get<{ items: Supplement[] }>("/supplements").then((r) => setItems(r.items || [])).catch(() => setItems([])).finally(() => setLoading(false)); };
  useEffect(load, []);
  const filtered = useMemo(() => items.filter((item) => (!category || item.category === category) && (!search.trim() || item.name.toLocaleLowerCase("el").includes(search.toLocaleLowerCase("el")))), [items, category, search]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(([value]) => [value, items.filter((item) => item.category === value).length])), [items]);
  const categoryChips: Array<[string, string, number]> = [["", "Όλα", items.length], ...CATEGORIES.map(([value, label]): [string, string, number] => [value, label, counts[value] || 0])];
  const openNew = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (item: Supplement) => { setEditing(item); setForm({ category: item.category, name: item.name, shortCode: item.shortCode || "", form: item.form || "", dailyDose: item.dailyDose, doseUnit: item.doseUnit || "", timing: item.timing || "", linkUrl: item.linkUrl || "" }); setFormOpen(true); };
  const save = async () => { if (!form.name.trim()) return; setSaving(true); try { const result = editing ? await api.put<Supplement>(`/supplements/${editing.id}`, form) : await api.post<Supplement>("/supplements", form); setItems((old) => editing ? old.map((item) => item.id === result.id ? result : item) : [result, ...old]); setFormOpen(false); } finally { setSaving(false); } };
  const remove = async (item: Supplement) => { if (!window.confirm(`Να διαγραφεί το «${item.name}»;`)) return; await api.delete(`/supplements/${item.id}`); setItems((old) => old.filter((value) => value.id !== item.id)); };

  return <CoachShell title="Τρόφιμα & συμπληρώματα" user={user} logout={logout}>
    <section className="mx-auto w-full max-w-[var(--container-7xl)] space-y-[18px] pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="flex items-center gap-3 text-[28px] font-extrabold tracking-[-.5px]"><span>Τρόφιμα & συμπληρώματα</span><span className="rounded-full bg-[#0b0b0b] px-2.5 py-1 text-[13px] text-accent">{items.length}</span></h1><p className="mt-1 text-sm text-[#6a6a6a]">Συνιστώμενη δόση ανά ημέρα. Ο coach μπορεί να την προσαρμόσει στο πλάνο κάθε πελάτη.</p></div><Button onClick={openNew} className="h-[46px] rounded-full bg-[#0b0b0b] px-5 text-white hover:bg-[#1f1f1f]"><Plus className="mr-2 size-4" />Νέο συμπλήρωμα</Button></div>
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex rounded-[14px] border border-border bg-white p-1"><Link href="/coach/foods" className="flex h-[38px] items-center gap-2 rounded-[10px] px-4 text-[13px] font-bold text-[#555]"><span>Τρόφιμα</span><span className="rounded-full bg-[#f2f2f0] px-1.5 text-[11px]">—</span></Link><span className="flex h-[38px] items-center gap-2 rounded-[10px] bg-accent px-4 text-[13px] font-extrabold"><Pill className="size-4" />Συμπληρώματα <span className="rounded-full bg-[#0b0b0b] px-1.5 text-[11px] text-accent">{items.length}</span></span></div><div className="hidden items-center gap-4 text-xs font-semibold text-[#555] lg:flex"><Legend color="bg-[#0b0b0b]" text="Πρωτεΐνες" /><Legend color="bg-accent" text="Απόδοση" /><Legend color="bg-[#ecece8]" text="Υγεία" /><Legend color="bg-[#1f1f1f]" text="Αποκατάσταση" /></div></div>
      <div className="flex flex-wrap gap-2"><div className="flex h-12 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-white px-4"><Search className="size-[18px] text-[#8a8a8a]" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Αναζήτηση συμπληρώματος…" className="h-auto border-0 p-0 shadow-none focus-visible:ring-0" /></div><Button variant="outline" className="h-12 rounded-xl px-4">Α → Ω</Button><div className="flex h-12 rounded-xl border border-border bg-white p-1"><Button size="icon-sm" onClick={() => setView("grid")} className={cn("size-10 rounded-[9px]", view === "grid" ? "bg-[#0b0b0b] text-white hover:bg-[#0b0b0b]" : "bg-transparent text-[#6a6a6a] hover:bg-[#f4f4f2]")}><Grid2X2 className="size-4" /></Button><Button size="icon-sm" onClick={() => setView("list")} className={cn("size-10 rounded-[9px]", view === "list" ? "bg-[#0b0b0b] text-white hover:bg-[#0b0b0b]" : "bg-transparent text-[#6a6a6a] hover:bg-[#f4f4f2]")}><List className="size-4" /></Button></div></div>
      <div className="relative -mx-1 overflow-hidden"><div className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">{categoryChips.map(([value, label, count]) => <button key={value || "all"} onClick={() => setCategory(value)} className={cn("h-[38px] shrink-0 rounded-full border px-4 text-[13px] font-semibold", category === value ? "border-[#0b0b0b] bg-[#0b0b0b] text-white" : "border-border bg-white text-[#333]")}>{label}<span className="ml-1.5 text-[11px] opacity-60">{count}</span></button>)}</div><span className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" /></div>
      <div className="flex min-h-7 flex-wrap items-center gap-2 text-[13px] text-[#6a6a6a]"><span><strong className="text-[#0b0b0b]">{filtered.length}</strong> αποτελέσματα</span>{category && <><span>·</span><button onClick={() => setCategory("")} className="flex h-7 items-center gap-1.5 rounded-full border border-[#0b0b0b] bg-white px-2.5 text-xs font-bold text-[#0b0b0b]">{categoryMeta(category).label} ×</button></>}</div>
      {loading ? <p className="py-20 text-center text-sm text-[#6a6a6a]">Φόρτωση…</p> : <div className={cn(view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "space-y-3")}>{filtered.map((item) => <SupplementCard key={item.id} item={item} list={view === "list"} onEdit={() => openEdit(item)} onDelete={() => remove(item)} />)}</div>}
    </section>
    <SupplementDialog open={formOpen} onOpenChange={setFormOpen} form={form} setForm={setForm} editing={Boolean(editing)} saving={saving} onSave={save} />
  </CoachShell>;
}

function SupplementCard({ item, list, onEdit, onDelete }: { item: Supplement; list: boolean; onEdit: () => void; onDelete: () => void }) { const meta = categoryMeta(item.category); return <Card className={cn("overflow-hidden rounded-[18px] border border-border bg-white p-0 shadow-none", list && "flex") }><div className={cn("relative h-[140px] overflow-hidden", visualTone(item.category), list && "w-[190px] shrink-0")}><i className="absolute right-[78px] -top-5 h-[190px] w-[14px] -skew-x-[16deg] bg-current opacity-30" /><i className="absolute right-[100px] -top-5 h-[190px] w-1 -skew-x-[16deg] bg-current opacity-20" /><span className="absolute bottom-1 left-4 text-[68px] font-extrabold italic leading-none tracking-[-3px]">{shortCode(item)}</span><span className="absolute bottom-3 right-3 text-[11px] font-bold uppercase tracking-[.6px] opacity-75">{item.form || "—"}</span><span className="absolute left-2.5 top-2.5 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-extrabold text-white">{meta.label}</span><div className="absolute right-2 top-2 flex rounded-lg bg-white/90 text-[#0b0b0b]"><Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Επεξεργασία"><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Διαγραφή"><Trash2 className="size-3.5 text-red-600" /></Button></div></div><div className="flex min-h-[154px] flex-1 flex-col gap-3 p-4"><div className="flex min-h-[38px] justify-between gap-2"><strong className="text-[15px] font-extrabold leading-tight">{item.name}</strong>{item.dailyDose != null && <span className="shrink-0 text-right leading-none"><b className="text-lg">{item.dailyDose}</b><small className="mt-0.5 block text-[10px] text-[#8a8a8a]">{item.doseUnit || ""} / ημέρα</small></span>}</div><p className="flex items-center gap-1.5 text-xs font-semibold text-[#555]"><Clock3 className="size-3.5" />{item.timing || "Δεν ορίστηκε χρόνος λήψης"}</p><Button className="mt-auto h-9 rounded-full bg-[#0b0b0b] text-xs text-white hover:bg-[#1f1f1f]"><Plus className="size-3.5" />Σε πλάνο διατροφής</Button></div></Card>; }
function Legend({ color, text }: { color: string; text: string }) { return <span className="flex items-center gap-1.5"><i className={cn("size-2.5 rounded-[3px] border border-[#d6d6d2]", color)} />{text}</span>; }
function SupplementDialog({ open, onOpenChange, form, setForm, editing, saving, onSave }: { open: boolean; onOpenChange: (value: boolean) => void; form: Form; setForm: React.Dispatch<React.SetStateAction<Form>>; editing: boolean; saving: boolean; onSave: () => void }) { const field = <K extends keyof Form>(key: K, value: Form[K]) => setForm((old) => ({ ...old, [key]: value })); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Επεξεργασία συμπληρώματος" : "Νέο συμπλήρωμα"}</DialogTitle><DialogDescription>Τα στοιχεία εμφανίζονται στη βιβλιοθήκη και μπορούν να χρησιμοποιηθούν στα πλάνα διατροφής.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Όνομα" className="sm:col-span-2"><Input value={form.name} onChange={(e) => field("name", e.target.value)} /></Field><Field label="Κατηγορία"><Select value={form.category} onValueChange={(value) => value && field("category", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label="Κωδικός"><Input value={form.shortCode || ""} maxLength={12} placeholder="π.χ. Cr" onChange={(e) => field("shortCode", e.target.value)} /></Field><Field label="Μορφή"><Input value={form.form || ""} placeholder="π.χ. Σκόνη" onChange={(e) => field("form", e.target.value)} /></Field><Field label="Χρόνος λήψης"><Input value={form.timing || ""} placeholder="π.χ. Μετά την προπόνηση" onChange={(e) => field("timing", e.target.value)} /></Field><Field label="Ημερήσια δόση"><Input type="number" min="0" value={form.dailyDose ?? ""} onChange={(e) => field("dailyDose", e.target.value === "" ? null : Number(e.target.value))} /></Field><Field label="Μονάδα"><Input value={form.doseUnit || ""} placeholder="g / κάψουλες" onChange={(e) => field("doseUnit", e.target.value)} /></Field><Field label="Link προϊόντος" className="sm:col-span-2"><Input type="url" value={form.linkUrl || ""} placeholder="https://…" onChange={(e) => field("linkUrl", e.target.value)} /></Field></div><Button disabled={saving || !form.name.trim()} onClick={onSave} className="mt-5 h-11 w-full rounded-full bg-[#0b0b0b] text-white">{saving ? "Αποθήκευση…" : "Αποθήκευση"}</Button></DialogContent></Dialog>; }
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) { return <Label className={cn("grid gap-2 text-sm font-bold", className)}>{label}{children}</Label>; }
export default function SupplementsPage() { return <ProtectedRoute allow="coach"><SupplementsContent /></ProtectedRoute>; }
